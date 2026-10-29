#!/usr/bin/env bash
# Owner-run local check of the evidence scraper against the real myPenalty site. NOT for CI, NOT for servers.
# Starts the backend on 127.0.0.1 with the live-browser profile and the scraper flags ON, sends ONE lookup, prints a
# REDACTED summary (state, yes/no per field, counts), and stops the backend.
#
# Inputs come from the environment or an interactive prompt, never from a file, and are never echoed, logged or committed:
#   NOTICE            penalty notice number (prompted silently if unset)
#   OFFENCE_DATE      DD/MM/YYYY or YYYY-MM-DD (prompted silently if unset)
#   REGISTRATION      vehicle registration, optional (prompted silently; empty = stop at the summary step)
#   LIVE_BASE_URL     https URL of the site (origin, or the full login URL); prompted if unset
#   LIVE_CONTACT      contact shown in the User-Agent so the site owner can reach you; prompted if unset
#   I_HAVE_APPROVAL   must be "yes" (or you answer the prompt): you have approval to make these automated requests
# Optional:
#   SAVE_HTML=yes|no  save the raw rendered HTML of each step to ./live-capture/ (gitignored; may hold real data)
#   LIVE_HEADED=1     show the browser window
#   LIVE_MIN_INTERVAL_MS  pause between site requests, default 5000, minimum 3000
#   LIVE_CHECK_PORT   local port, default 8099
#   LIVE_CERT_APPROVAL_REF  also run the certificate lookup (needs the owner's approval reference)
# See docs/LIVE-CHECK.md.
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${LIVE_CHECK_PORT:-8099}"
CAPTURE_DIR="$ROOT/live-capture"
LOG="$CAPTURE_DIR/backend.log"

die() { echo "live-check: $*" >&2; exit 1; }
command -v mvn >/dev/null 2>&1 || die "Maven (mvn) is required"
command -v curl >/dev/null 2>&1 || die "curl is required"
command -v java >/dev/null 2>&1 || die "Java 21 is required"

# Prompts: silent (-s) so nothing is echoed. Only used when the variable is not already set.
ask_secret() { # name prompt
  local v="${!1:-}"
  if [ -z "$v" ] && [ -t 0 ]; then
    read -r -s -p "$2: " v; echo >&2
  fi
  printf '%s' "$v"
}
NOTICE_V="$(ask_secret NOTICE 'Notice number')"
DATE_V="$(ask_secret OFFENCE_DATE 'Offence date (DD/MM/YYYY)')"
if [ -z "${REGISTRATION+x}" ] && [ -t 0 ]; then
  read -r -s -p "Registration (optional, Enter to skip): " REG_V; echo >&2
else
  REG_V="${REGISTRATION:-}"
fi
BASE_V="${LIVE_BASE_URL:-}"
if [ -z "$BASE_V" ] && [ -t 0 ]; then read -r -p "Site base URL (https://...): " BASE_V; fi
CONTACT_V="${LIVE_CONTACT:-}"
if [ -z "$CONTACT_V" ] && [ -t 0 ]; then read -r -p "Your contact (email) for the User-Agent: " CONTACT_V; fi
APPROVAL_V="${I_HAVE_APPROVAL:-}"
if [ -z "$APPROVAL_V" ] && [ -t 0 ]; then
  read -r -p "Do you have approval to make these automated requests? (yes/no): " APPROVAL_V
fi
SAVE_V="${SAVE_HTML:-}"
if [ -z "$SAVE_V" ] && [ -t 0 ]; then read -r -p "Save raw rendered HTML to ./live-capture/ ? (yes/no): " SAVE_V; fi

# Validation (also makes the JSON below safe to build without escaping).
[ "$APPROVAL_V" = "yes" ] || die "approval not confirmed; nothing was run"
[[ "$NOTICE_V" =~ ^[A-Za-z0-9]{4,20}$ ]] || die "notice number is missing or not in the expected shape"
if [[ "$DATE_V" =~ ^([0-9]{2})/([0-9]{2})/([0-9]{4})$ ]]; then
  DATE_ISO="${BASH_REMATCH[3]}-${BASH_REMATCH[2]}-${BASH_REMATCH[1]}"
elif [[ "$DATE_V" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  DATE_ISO="$DATE_V"
else
  die "offence date must be DD/MM/YYYY or YYYY-MM-DD"
fi
if [ -n "$REG_V" ]; then [[ "$REG_V" =~ ^[A-Za-z0-9\ -]{1,10}$ ]] || die "registration not in the expected shape"; fi
[[ "$BASE_V" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9._/-]*)?$ ]] || die "LIVE_BASE_URL must be an https URL"
[[ "$CONTACT_V" =~ ^[A-Za-z0-9._@+-]{3,80}$ ]] || die "LIVE_CONTACT must be a simple email or name (no spaces)"
[[ "$PORT" =~ ^[0-9]{2,5}$ ]] || die "LIVE_CHECK_PORT must be a number"
MIN_MS="${LIVE_MIN_INTERVAL_MS:-5000}"
[[ "$MIN_MS" =~ ^[0-9]+$ ]] && [ "$MIN_MS" -ge 3000 ] || die "LIVE_MIN_INTERVAL_MS must be a number, at least 3000"

mkdir -p "$CAPTURE_DIR"; chmod 700 "$CAPTURE_DIR"

# Backend environment. The three secrets are NOT exported to it (env -u), they only travel in the request body.
BACKEND_ENV=(
  "SERVER_ADDRESS=127.0.0.1" "SERVER_PORT=$PORT"
  "LOGGING_LEVEL_ROOT=WARN" "LOGGING_LEVEL_AU_GOV_NSW_TRANSPORT_CEVOC=INFO"
  "CEVOC_PENALTY_LOOKUP_ADAPTER=scraper-evidence"
  "CEVOC_SCRAPER_ENABLED=true"
  "CEVOC_SCRAPER_EVIDENCE_ENABLED=true"
  "CEVOC_SCRAPER_EVIDENCE_BROWSER=playwright"
  "CEVOC_SCRAPER_EVIDENCE_BASE_URL=$BASE_V"
  "CEVOC_SCRAPER_EVIDENCE_CONTACT=$CONTACT_V"
  "CEVOC_SCRAPER_EVIDENCE_MIN_INTERVAL_MS=$MIN_MS"
  "CEVOC_LIVE_CHECK_ENABLED=true"
)
[ "${LIVE_HEADED:-}" = "1" ] && BACKEND_ENV+=("CEVOC_SCRAPER_EVIDENCE_BROWSER_HEADLESS=false")
[ "$SAVE_V" = "yes" ] && BACKEND_ENV+=("CEVOC_LIVE_CHECK_CAPTURE_DIR=$CAPTURE_DIR")
if [ -n "${LIVE_CERT_APPROVAL_REF:-}" ]; then
  BACKEND_ENV+=("CEVOC_SCRAPER_CERTIFICATES_ENABLED=true" "CEVOC_SCRAPER_CERTIFICATES_APPROVAL_REFERENCE=$LIVE_CERT_APPROVAL_REF")
fi

echo "live-check: starting backend on 127.0.0.1:$PORT (first run downloads dependencies and Chromium; this can take minutes)..."
(cd "$ROOT/backend" && exec env -u NOTICE -u OFFENCE_DATE -u REGISTRATION "${BACKEND_ENV[@]}" \
   mvn -B -q -Plive-browser spring-boot:run) >"$LOG" 2>&1 &
BACKEND_PID=$!
cleanup() {
  pkill -P "$BACKEND_PID" 2>/dev/null || true
  kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

up=""
for _ in $(seq 1 180); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/live-check/ping" 2>/dev/null; then up=1; break; fi
  kill -0 "$BACKEND_PID" 2>/dev/null || die "backend exited early; see $LOG"
  sleep 2
done
[ -n "$up" ] || die "backend did not start in time; see $LOG"

echo "live-check: running one lookup (slow on purpose: about $((MIN_MS/1000))s between site requests)..."
# The request body goes through stdin (printf is a shell builtin), so it never appears in a process list.
printf '{"notice":"%s","offenceDate":"%s","registration":"%s"}' "$NOTICE_V" "$DATE_ISO" "$REG_V" \
  | curl -sS --max-time 900 -H 'Content-Type: application/json' --data-binary @- \
      "http://127.0.0.1:$PORT/live-check/lookup" || die "lookup request failed; see $LOG"
echo
if [ "$SAVE_V" = "yes" ]; then
  echo "live-check: raw rendered HTML saved in $CAPTURE_DIR (may contain real data: redact before sharing)."
fi
echo "live-check: done. Stopping backend."
