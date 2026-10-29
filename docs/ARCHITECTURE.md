# Architecture

Hexagonal. Dependencies point inwards: `adapter` -> `application` -> `domain`. `ArchitectureTest` enforces this.

    backend/src/main/java/au/gov/nsw/transport/cevoc
      domain/                 records only, no framework
      application/port/in/    LookupPenaltyUseCase   (what the outside can ask)
      application/port/out/   PenaltyLookupPort      (how we get content)
                              MediaStoragePort, SignedLinkPort, CacheInvalidationPort (media, cloud-neutral)
      application/service/    LookupPenaltyService
      adapter/in/web/         REST controller (public, unauthenticated)
      adapter/out/stub/       StubPenaltyLookupAdapter (fictitious data), StubMediaAdapter (sample-file links)
      adapter/out/azureblob/  Azure Blob adapter (SAS links); the only place com.azure is allowed (plus config)
      adapter/out/s3/         placeholder only: where the AWS adapter will go
      config/                 BeanConfig: the only place that chooses an adapter

## Media (evidence images, video, certificates)
The backend never proxies media bytes. It only returns short-lived links; the browser fetches from storage/CDN.
- `MediaStoragePort`: store/locate objects by key. `SignedLinkPort`: short-lived, unguessable, read-only link. `CacheInvalidationPort`: purge CDN/cache for a key.
- A `PenaltyLookupPort` adapter returns evidence items carrying an object key; `LookupPenaltyService` turns each into a link via `SignedLinkPort` (5 minute validity).
- Select with `cevoc.media.adapter`:
  - `stub` (default): links are `cevoc.media.base-url` (default `/samples`) + key. No cloud account needed.
  - `azure-blob`: read-only SAS URLs. Needs `cevoc.media.azure.connection-string` (use `AZURE_STORAGE_CONNECTION_STRING`; keep it out of git) and optional `cevoc.media.azure.container` (default `evidence`). Upload the sample objects (`image-1.jpg`, `video-1.mp4`, `cert-1.pdf`) to the container to try it.
- `ArchitectureTest` forbids cloud SDKs (`com.azure`, `software.amazon`, ...) in `domain` and `application`, and stops the azure and s3 adapter packages depending on each other.

### Adding an S3 / CloudFront adapter
1. Add the AWS SDK v2 dependencies (`s3`, optionally `cloudfront`) to `pom.xml`.
2. Create `adapter/out/s3/` with: `S3MediaStorageAdapter` (MediaStoragePort), `CloudFrontSignedLinkAdapter` (SignedLinkPort, CloudFront signed URLs with a key pair, or `S3Presigner` for plain S3), `CloudFrontInvalidationAdapter` (CacheInvalidationPort, `CreateInvalidation`).
3. In `BeanConfig` add beans conditional on `cevoc.media.adapter=s3`, with its own properties (bucket, distribution domain, key pair id, private key from a secret store).
4. Do not touch `domain` or `application`; `ArchitectureTest` will fail if AWS types leak in.

## Swapping sources later
Select with `cevoc.penalty-lookup.adapter`. Planned adapters, none built yet:
- `revenue-nsw`: pass the notice number and offence date to the public Revenue NSW / Service NSW page and extract the returned content.
- `evidence-api`: real image, video and certificate APIs, with caching or buffering.

## Scraper adapter (prototype only, off by default)
`adapter/out/scraper/` can read a Revenue NSW style penalty page and copy its images and videos into storage through `MediaStoragePort`, returning object keys like any other `PenaltyLookupPort`.

**Production use needs the site owner's (Revenue NSW / Service NSW) written approval first. It should be replaced by the real evidence API.** Transport for NSW (Arjan) obtains that approval before it is ever enabled. Until then it must stay off.

Safeguards:
- Never the default. `stub` stays the default in code, tests and every shipped config. It runs only if `cevoc.penalty-lookup.adapter=scraper-evidence` AND `cevoc.scraper.evidence.enabled=true` (env `CEVOC_SCRAPER_EVIDENCE_ENABLED`, default `false`). It also needs `cevoc.scraper.evidence.base-url` (https) and `cevoc.scraper.evidence.contact`; with any of these missing it returns `LIVE_LOOKUP_OFF` and makes no network call.
- Polite: identifying User-Agent (`CEVOC-prototype/0.1 (Transport for NSW; contact: ...)`), minimum 5 s between requests (`min-interval-ms`), connect and request timeouts, 25 MB size cap, strictly sequential (no parallelism), no redirects, media only from the same https host, 2 minute result cache (`cache-ttl-seconds`).
- Isolation: all HTML knowledge lives in `RevenueNswPageParser`; a site change should break only that class and its fixture.
- Tests (`ScraperEvidenceTest`) use saved fictitious HTML in `backend/src/test/resources/fixtures/scraper/` and fakes. No live network, no real notice numbers or personal data.

### TODO before this can work against the real site (page structure is unknown)
1. Arjan supplies a screenshot or page source (saved, with any real notice data removed) of a results page, a not-found page, and a notice with no evidence.
2. Confirm how the two inputs are submitted (GET, POST form, token or captcha, identity step) and update `searchUri`.
3. Rewrite `RevenueNswPageParser` selectors and fixtures to match; confirm date, time and amount formats.
4. Confirm how images and video are served (direct files, lazy loading, streaming). Streamed video cannot be buffered by this adapter.
5. Check robots.txt and terms; obtain written approval; agree rate limits and a contact address with the owner.
6. Then plan the move to the real evidence API and delete this adapter.

## Open questions
- How the Revenue NSW / Service NSW page accepts the two inputs, and whether it needs an identity step. Automated pass-through must be confirmed as permitted before building that adapter.
- The public certificates page (`/cevoc/pages/sdro/searchCertificates.jsf`) blocks automated fetching via robots.txt. Its form structure needs to be captured by a person.
