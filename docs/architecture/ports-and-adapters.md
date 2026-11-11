# Ports and adapters

Every external concern is behind a port (interface). Adapters implement ports. The application layer orchestrates use cases through ports and never knows which adapter is running.

## Inbound ports (driving)

| Port | Package | Purpose |
|---|---|---|
| `LookupPenaltyUseCase` | `application.port.in` | The main use case: look up a penalty notice and return evidence |
| `LookupSink` | `application.port.in` | SSE streaming callback: progress updates during lookup |

## Outbound ports (driven)

| Port | Adapters | Purpose |
|---|---|---|
| `PenaltyLookupPort` | `scraper` (browser), `revenuensw` (HTTP), `demo`, `stub` | Fetch notice details and evidence from a source |
| `CertificateSourcePort` | `scraper` (browser, HTTP), `demo` | Fetch camera certificates |
| `MediaStoragePort` | `memory`, `azureblob`, `s3` | Store and retrieve evidence media bytes |
| `MediaReadPort` | `memory`, `azureblob`, `s3` | Read media by hash |
| `BlurPort` | `blur/ProcessBlurAdapter` | Blur faces and plates in video/images |
| `BannerTextReaderPort` | `ocr/TesseractBannerTextReader` | Read camera banner text (speed, timing) from image pixels |
| `SignedLinkPort` | `adapter.in.web` | Generate time-limited signed URLs for media access |
| `EnforcementSiteResolver` | `stub` | Map location text to certificate search location (placeholder) |
| `DemoCatalogPort` | `demo` | List demo cases for the hub page |
| `DemoMediaPort` | `demo` | Serve demo media (images, video) |
| `DemoBundleSourcePort` | `httpbundle` | Fetch demo media bundles from external URL |
| `CacheInvalidationPort` | (internal) | Invalidate cached media on change |
| `LookupProgress` | `adapter.in.web` | Report lookup progress to SSE stream |

## Adapter selection

Each concern has ONE setting that picks the adapter. No per-adapter on/off switches.

| Setting | Values | Default |
|---|---|---|
| `cevoc.penalty-lookup.adapter` | `browser`, `http`, `stub`, `api` (reserved) | `browser` |
| `cevoc.certificates.providers` | `http`, `browser`, `none`, `api` (reserved) | `http,browser` |
| `cevoc.media.adapter` | `memory`, `azure-blob`, `s3` | `memory` (when browser or http) |
| `CEVOC_DEMO_DATA_ENABLED` | `true`, anything else = off | off |

## Adding a new adapter

To add a new data source (e.g. a TfNSW API):

1. **Create the adapter package**: `adapter/out/tfnsw/`
2. **Implement the port**: `class TfnswLookupAdapter implements PenaltyLookupPort`
3. **Add configuration**: new value in `LookupAdapterKind` enum, new bean in `BeanConfig`
4. **Wire it**: add `@ConditionalOnProperty` in `BeanConfig` for `cevoc.penalty-lookup.adapter=api`
5. **Add ArchUnit rules**: ensure the new adapter is isolated (doesn't import other adapters)
6. **Document**: add a decision record in `docs/decisions/`

The domain and application layers do not change. The frontend does not change. No other adapter is affected.
