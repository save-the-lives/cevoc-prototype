# 0022. The real adapters are the defaults; only the contact is required

Status: DECIDED (owner direction, 2026-11-06); built on branch `defaults`.

## Context
The penalty lookup adapter and the certificate providers are hexagonal adapters. The default configuration was the stand-in (`stub`, no certificate source), so the owner had to set several variables in Azure to get the real behaviour, and a normal deploy (record 0021) leaves them as they are.

## Decision
1. Empty or unset `CEVOC_PENALTY_LOOKUP_ADAPTER` means `browser` (Chromium). `stub` is an explicit choice (`CEVOC_PENALTY_LOOKUP_ADAPTER=stub`). `http` and the reserved `api` are unchanged. An unknown value is still not an alias: it falls back to `stub` (nothing is contacted) with a warning.
2. Empty or unset `CEVOC_CERTIFICATES_PROVIDERS` means `browser`. The explicit value `none` means no certificate source (tests, local work). Unknown names are still ignored with a warning.
3. Addresses have fully qualified defaults: certificates `https://cevoc.transport.nsw.gov.au/cevoc/pages/sdro/searchCertificates.jsf`; evidence `https://www.apps09.revenue.nsw.gov.au/customer_service/finesonline/` (`ScraperSettings.DEFAULT_URL`; host from the recorded network map, path from the Chromium session). Both are optional overrides.
4. `CEVOC_SCRAPER_EVIDENCE_CONTACT` has no sensible default and stays required. When it is blank the app starts, logs one error line naming the variable, makes no request, and lookups and certificate checks answer the existing "switched off / not available" message. The `http` certificates provider no longer stops start-up for the same reason.
5. Demo data stays off by default; live check stays a separate off-by-default switch (`CEVOC_LIVECHECK_ENABLED`).
6. `CEVOC_CERTIFICATES_APPROVAL_REFERENCE` is removed: its only effect was a log line.
7. The adapter variables remain optional overrides, so moving to AWS or the real API later is one setting.

## Consequences
- The minimal Azure set is `CEVOC_SCRAPER_EVIDENCE_CONTACT`. Everything else is an override (`docs/CONFIG-REFERENCE.md` section 0).
- An owner who still has `CEVOC_PENALTY_LOOKUP_ADAPTER=stub` (or a retired value) keeps the stand-in until the variable is deleted.
- Tests and local runs that must not reach the site select `stub` and `none` explicitly; without them the default context starts the browser adapter (inert without a contact, no network call).
- RISK: the browser default needs Chromium, about 2 CPU / 4 GiB. Normal deploys no longer touch the size (record 0021), so the owner must have set it in the portal before setting the contact; on a smaller app Chromium would be killed. The post-deploy check is `GET /api/ping`, which cannot reach the real site.
