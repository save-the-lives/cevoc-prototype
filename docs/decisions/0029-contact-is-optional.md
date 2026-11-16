# 0029. The lookup contact is optional

Status: DECIDED (owner direction, 2026-11-17); built. Supersedes point 4 of record 0022.

## Context
Record 0022 kept one required setting, `CEVOC_SCRAPER_EVIDENCE_CONTACT`: without it the browser lookup route and the
`http` certificates provider made no request. A new environment therefore answered "not available" to every real
lookup until someone set it, and on 2026-11-17 an address was invented as a default to get past that.

## Decision
The contact no longer gates anything. `ScraperSettings.usable()` needs only the address (which has a default).
When `CEVOC_SCRAPER_EVIDENCE_CONTACT` is set it is added to the User-Agent (`CEVOC/1.0 (contact: ...)`); when it is
blank the User-Agent is `CEVOC/1.0`. No default contact is shipped.

## Consequences
- A new environment needs no lookup settings at all.
- **The contact was also what kept the scraper off by default.** With no settings, the browser route now runs
  wherever the image has Chromium. `CEVOC_PENALTY_LOOKUP_ADAPTER=stub` and `CEVOC_CERTIFICATES_PROVIDERS=none` are
  the explicit off switches (local runs and tests already use them). Logged in `docs/exceptions.md` as
  `scrapers-on-by-default` until the owner confirms.
- The site owner can no longer identify the caller unless a contact is set.
- Docs that still say the contact is required (`docs/CONFIG-REFERENCE.md`, `docs/ARCHITECTURE.md`,
  `docs/HANDOVER.md`, `docs/LIVE-CHECK.md`) are out of date on that point; this record wins.
- About ten backend tests assert the old behaviour and fail (`docs/exceptions.md`, `tests-red`).

## Ruled out
- A shipped default address: it would be an invented identity in a public repository.
- Setting the contact from a repository variable in the deploy workflow: workable, and the way back if the owner
  wants the off-by-default behaviour restored (revert this record's code change and pass the variable).
