# 0024 Certificates: plain HTTP with browser headers, first in the chain (2026-11-07)

**Status:** owner direction. TEMPORARY, removed at cutover to the API provider. Not verified live.

**Context.** Bot management in front of the certificates search page refused every Playwright request (three attempts: headless mode, user agent, `navigator.webdriver`), with no cookie issued. A plain `curl` from the same Azure container with browser-like headers got HTTP 200, so the network path and the page are reachable without a browser.

**Decision.**
- The `http` provider (`SearchPageHttpCertificateSource`: GET the form, read the JSF view state and field names, POST the search, parse the table) sends the headers of a desktop Chrome navigation (`BrowserHeaders`). This reverses 0023's "no browser user agent on a non-browser client" for this leg only. Switch: `cevoc.certificates.search-page.http-browser-headers` (default true); false restores the identifying agent.
- The default list is now `http,browser`. Without the contact the `http` leg is skipped (as before) and only `browser` runs.
- `HttpLegFallbackSource`: a refusal (401, 403, 429) of the HTTP leg becomes the ordinary failure `http-leg-refused-<status>` so the chain tries `browser`, the approved session. The browser leg's refusal still stops the chain. Nothing is retried.
- Logged: method, status, milliseconds; form fetched, view state found, results parsed, count. No URLs with query, header values, camera codes, dates or certificate data.

**Not done / limits.** (Updated 2026-11-07: `Accept-Encoding: gzip` is now sent and the fetcher inflates gzip bodies.) Bot management may also judge the TLS fingerprint (JDK differs from Chrome); only a live run shows it. The headers claim to be Chrome 131 on Linux and will need refreshing as Chrome moves on. Robots.txt still disallows automated access; the interim approval of 2026-11-04 stands, and a refusal is never retried or routed round.
