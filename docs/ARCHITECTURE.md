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

## Open questions
- How the Revenue NSW / Service NSW page accepts the two inputs, and whether it needs an identity step. Automated pass-through must be confirmed as permitted before building that adapter.
- The public certificates page (`/cevoc/pages/sdro/searchCertificates.jsf`) blocks automated fetching via robots.txt. Its form structure needs to be captured by a person.

## Live lookup order and scraper switches (build-only, OFF everywhere)

`LayeredPenaltyLookup` answers in this order: (1) the manifest/stub lookup; (2) if that says live lookup is
switched off AND a live source adapter exists, ask `EvidenceSourcePort` (notice details, images, videos;
media is buffered into the media storage port, never proxied per view) and/or `CertificateSourcePort`;
(3) otherwise the friendly "switched off" result (`LIVE_LOOKUP_OFF`) stands.

No scraper adapter exists yet, so the switches below currently do nothing. When one is built it must be a bean
conditional on its flag, never the default, polite (identifying User-Agent, rate limit, timeouts, brief cache),
tested only against fictitious saved HTML, and used only after the site owner has approved automated access
(robots.txt currently disallows it). Production use should be replaced by the real API.

| Environment variable | Property | Default |
|---|---|---|
| `CEVOC_EVIDENCE_SCRAPER_ENABLED` | `cevoc.evidence.scraper.enabled` | `false` |
| `CEVOC_CERTIFICATE_SCRAPER_ENABLED` | `cevoc.certificate.scraper.enabled` | `false` |
| `CEVOC_PENALTY_LOOKUP_ADAPTER` | `cevoc.penalty-lookup.adapter` | `stub` |

Open question: if certificates are keyed by enforcement site rather than notice number, add an
`EnforcementSiteLookupPort` (stub with fictitious site numbers) in front of `CertificateSourcePort`.
