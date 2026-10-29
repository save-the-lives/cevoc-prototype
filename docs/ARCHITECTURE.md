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

## Certificate scraper (inert by default, owner approval required)
`CertificateSourcePort` (application/port/out) returns `CertificateRef`s for a `CertificateQuery`. The only adapter, `adapter/out/scraper`, reads the enforcement-centre certificates JSF page. It is NOT wired into the lookup flow and is never a default.
- Off unless `cevoc.scraper.certificates.enabled=true` (env `CEVOC_SCRAPER_CERTIFICATES_ENABLED`, default false). When enabled, `cevoc.scraper.certificates.approval-reference` (the owner's approval reference) is also required or startup fails.
- Polite: identifying User-Agent (`...user-agent`), min 5 s between requests (`...min-interval-ms`, floor 2000), connect/request timeouts, one request at a time, no retries, cache of at most 10 minutes (`...cache-ttl-seconds`, default 300).
- `CertificatePageParser` is the only class that knows the HTML and JSF ViewState handling. Tests use fictitious fixtures in `src/test/resources/scraper/certificates`, never live calls.
- Key strategy `cevoc.scraper.certificates.key-strategy`: `BY_PENALTY` (penalty number gives certificates directly, default) or `VIA_ENFORCEMENT_SITE` (penalty -> enforcement site number -> certificate). OPEN QUESTION: Arjan to confirm which applies.
- robots.txt disallows automated access. Production use needs the owner's approval, and this adapter should be replaced by the real certificate API.

### TODO for Arjan (page structure is unknown; selectors in `CertificatePageParser` are guesses)
Supply a screenshot or the page source (saved by a person, with approval) showing: form id; penalty number and enforcement site number input names; search button name; results layout (table/datalist/PrimeFaces) and column order; how a site is selected; how a certificate document is referenced (link, command link, download); date format and the "no results" message; whether any captcha or login exists (if so, do not automate). Then update the constants and fixtures.

## Open questions
- How the Revenue NSW / Service NSW page accepts the two inputs, and whether it needs an identity step. Automated pass-through must be confirmed as permitted before building that adapter.
- The public certificates page (`/cevoc/pages/sdro/searchCertificates.jsf`) blocks automated fetching via robots.txt. Its form structure needs to be captured by a person.
- Certificates key: by penalty number alone, or penalty -> enforcement site number -> certificate (see the scraper section).
