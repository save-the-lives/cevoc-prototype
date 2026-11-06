# 0025 Certificates: a curl provider, first in the chain (2026-11-07)

**Status:** owner direction. TEMPORARY, removed at cutover to the API provider. Not verified live.

**Context.** Five attempts failed. Bot management in front of the certificates search page refuses Playwright (automation detection) and the JDK HTTP client even with browser headers (record 0024). A `curl` run by the owner from inside the same Azure container got HTTP 200. The difference is the TLS fingerprint: curl (OpenSSL) is accepted, the JDK's TLS stack is not.

**Decision.**
- New provider `curl` (`CurlCertificateSource`, `CurlPageFetcher`). It is the same search as `http` (it reuses `SearchPageHttpCertificateSource`: GET the form, read the JSF view state and field names, POST location code, date from and to, parse the table), but each request is the `curl` program started with `ProcessBuilder`. No shell is involved; arguments are a list.
- Headers as the owner proved: Chrome user agent, Accept, `Accept-Language: en-AU,en;q=0.9`, `Accept-Encoding: gzip, deflate, br`, `Sec-Fetch-Site/Mode/Dest`, `Connection: keep-alive`; the POST adds the form content type, Origin and Referer. `--compressed` decodes the body.
- One cookie jar file (`--cookie` and `--cookie-jar`) in a private temp directory per lookup carries the Akamai and session cookies across the GET and the POST. The POST body is written to a file in that directory and sent with `--data-binary @file`, so the view state is not in the process list. The directory is deleted after every lookup, success or failure.
- Each request: 10 seconds (`--connect-timeout`, `--max-time`), HTTPS only (`--proto =https`), at most 5 redirects.
- Default list is now `curl,http,browser`. Select alone with `CEVOC_CERTIFICATES_PROVIDERS=curl`. Needs no contact (it does not use the identifying agent). When another provider follows, a refusal (401, 403, 429) of the curl leg is wrapped as an ordinary failure (`HttpLegFallbackSource`) so the chain continues; a refusal of the last provider still stops the chain. Nothing is retried.
- The image installs `curl` (`backend/Dockerfile`).
- Logged: method, HTTP status, milliseconds, curl exit code; on a non-zero exit curl's stderr (one line, session ids removed, 300 characters at most); form fetched, view state found, results parsed, count. Never the response body, a URL with query, a header value, the location code, dates or certificate data.

**Not done / limits.** Fingerprint acceptance is only proven by a live run, which CI cannot do. The Chrome user agent string will need refreshing as Chrome moves on. Brotli (`br`) is requested as the owner's command did; if the installed curl cannot decode it the request fails with a curl exit code and the chain moves on. Robots.txt still disallows automated access; the interim approval of 2026-11-04 stands, and a refusal is never retried or routed round.
