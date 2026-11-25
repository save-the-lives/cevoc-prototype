#!/usr/bin/env bash
# "Exam": install and update the site exactly as Arjan does on his XAMPP server, then check it.
#   Apache + mod_php + pdo_sqlite, site at /MSCR/cevoc-site/ (a subfolder of htdocs), AllowOverride All,
#   installed with `git clone -b site`, updated with plain `git pull -q` after each deploy.
# Deploys go through scripts/publish-site-branch.sh, the same script deploy.yml runs.
# Usage: exam/run-exam.sh [--legacy-publish]   (--legacy-publish replays the old orphan force-push, to show the failure)
# Needs: apache2, libapache2-mod-php, php-sqlite3, git, node + playwright. Linux only (CI or sandbox).
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$PWD; LEGACY=${1:-}
SUDO=; [ "$(id -u)" = 0 ] || SUDO=sudo
E=$(mktemp -d /tmp/cevoc-exam.XXXX); PORT=${EXAM_PORT:-8088}
SITE=$E/htdocs/MSCR/cevoc-site; ORIGIN=$E/origin.git
pass() { echo "PASS  $*"; }; failx() { echo "FAIL  $*"; exit 1; }
export GIT_AUTHOR_NAME=exam GIT_AUTHOR_EMAIL=exam@example.invalid GIT_COMMITTER_NAME=exam GIT_COMMITTER_EMAIL=exam@example.invalid

publish() {  # $1 build dir, $2 message
  if [ "$LEGACY" = --legacy-publish ]; then
    rm -rf "$E/legacy" && cp -a "$1" "$E/legacy" && cd "$E/legacy" && git init -q -b site && git add -A \
      && git commit -qm "$2" && git push -qf "$ORIGIN" site && cd "$ROOT"
  else
    bash scripts/publish-site-branch.sh "$1" "$ORIGIN" "$2"
  fi
}

echo "== build"; npm run build --silent >/dev/null; cp -a dist "$E/build1"
git init -q --bare "$ORIGIN"
publish "$E/build1" "deploy 1"

echo "== install as on the server: git clone -b site"
mkdir -p "$E/htdocs/MSCR"; git clone -q -b site "$ORIGIN" "$SITE"
chmod -R a+rwX "$SITE"   # on Windows XAMPP Apache runs as the logged-in user and can write here
git config --global --add safe.directory "$SITE" || true

cat > "$E/httpd.conf" <<CONF
ServerRoot /etc/apache2
PidFile $E/httpd.pid
Listen 127.0.0.1:$PORT
ServerName localhost
User www-data
Group www-data
LoadModule mpm_prefork_module /usr/lib/apache2/modules/mod_mpm_prefork.so
LoadModule authz_core_module /usr/lib/apache2/modules/mod_authz_core.so
LoadModule alias_module /usr/lib/apache2/modules/mod_alias.so
LoadModule dir_module /usr/lib/apache2/modules/mod_dir.so
LoadModule mime_module /usr/lib/apache2/modules/mod_mime.so
LoadModule php_module $(ls /usr/lib/apache2/modules/libphp8*.so | head -1)
TypesConfig /etc/mime.types
ErrorLog $E/error.log
DocumentRoot $E/htdocs
<Directory $E/htdocs>
  AllowOverride All
  Require all granted
</Directory>
<FilesMatch \.php$>
  SetHandler application/x-httpd-php
</FilesMatch>
CONF
chmod o+x "$E" "$E/htdocs" "$E/htdocs/MSCR"
$SUDO apache2 -f "$E/httpd.conf" -k start; sleep 1
trap '$SUDO apache2 -f "$E/httpd.conf" -k stop 2>/dev/null || true' EXIT
BASE=http://127.0.0.1:$PORT/MSCR/cevoc-site/

echo "== exam part 1: fresh install"
node exam/exam.cjs "$BASE" part1 || { tail -20 "$E/error.log"; failx "part 1"; }

echo "== deploys 2 and 3, each followed by the server's git pull"
for n in 2 3; do
  rm -rf "$E/build$n"; cp -a "$E/build1" "$E/build$n"; echo "deploy $n" > "$E/build$n/exam-version.txt"
  publish "$E/build$n" "deploy $n"
  if (cd "$SITE" && git pull -q) ; then pass "git pull after deploy $n"; else failx "git pull after deploy $n (the server would be stuck on the old site)"; fi
  grep -qx "deploy $n" "$SITE/exam-version.txt" && pass "server has deploy $n" || failx "server does not have deploy $n"
  [ -f "$SITE/data/cevoc.sqlite" ] && pass "data/cevoc.sqlite kept by the pull" || failx "database lost after pull"
  [ -z "$(cd "$SITE" && git status --porcelain)" ] && pass "git status clean (database not tracked or shown)" || { (cd "$SITE" && git status --short); failx "working tree not clean after pull"; }
done

echo "== exam part 2: shared edits survive the pulls"
node exam/exam.cjs "$BASE" part2 || { tail -20 "$E/error.log"; failx "part 2"; }
echo "== ALL PASSED ($E)"
