# 0023 Certificates: HTTP first, browser as fallback (2026-11-07)

**Status:** accepted on the owner's direction. TEMPORARY, like the whole browser route: removed at cutover to the API provider.

**Context.** Chromium needs 2 CPU / 4 GiB. A curl from the Azure container reached the certificates search page (200), so the network path is fine; the browser session's 403 came from bot management refusing the identifying user agent (fixed separately: the certificates session now uses Chromium's own agent, setting `browser-default-user-agent`).

**Decision.** Built into the `browser` provider, not a separate provider in the chain: the two legs share one cache key, one set of safeguards and one "certificates" step, and a separate provider would make the chain treat an HTTP 403 as a final answer instead of a cue to start the browser.
- `SessionCookies` (in memory, one replica): after each successful browser search the session's cookies are kept, allow-listed to `JSESSIONID`, `ak_bmsc`, `bm_sv`, for 15 minutes. Values are never logged.
- `HttpFirstCertificateSource`: with fresh cookies, run the existing `SearchPageHttpCertificateSource` flow (GET form for the JSF state, POST search) seeded with them. Any failure (403, expired session, no form, parse) clears the cookies and calls the browser source, whose success refreshes them. Notes: `cert-http-first=hit | cold (cookieless attempt; "; result=hit" or "; fallback; cause=<token>") | fallback; cause=<token>`.
- Switch: `cevoc.certificates.search-page.http-first` (default true).

**Safeguards kept.** Honest identifying user agent on the HTTP leg (no browser user agent is copied onto a non-browser client), polite pacing, one lookup at a time, no captcha automation. The HTTP leg's refusal is not "worked around": it hands over to the browser, which is the approved session for this page; the browser leg's own refusal still ends the attempt as `blocked-<status>`.

**Risk.** Bot-management cookies are often bound to the client that earned them (agent, TLS fingerprint). If so the HTTP leg will always fall back and cost one extra request per lookup until the cookies are dropped; harmless but no saving. Only a live run can show the hit rate (`cert-http-first=` notes). Not verified live.
