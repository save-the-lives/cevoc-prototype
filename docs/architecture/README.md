# Architecture overview

CEVOC is a public, no-login web app for motorists to view the evidence behind a camera fine. It follows **hexagonal architecture** (ports and adapters), enforced by ArchUnit at build time.

## Structure

```
                         ┌─────────────────────────────┐
                         │         DOMAIN               │
                         │  PenaltyLookupResult         │
                         │  EvidenceItem, CertificateItem│
                         │  LookupTrace, NoticeDetails  │
                         │  (no infrastructure imports) │
                         └──────────┬──────────────────┘
                                    │
                         ┌──────────▼──────────────────┐
                         │       APPLICATION            │
                         │  Ports (interfaces):         │
                         │   IN:  LookupPenaltyUseCase  │
                         │   OUT: PenaltyLookupPort     │
                         │        CertificateSourcePort │
                         │        MediaStoragePort      │
                         │        BlurPort              │
                         │        BannerTextReaderPort  │
                         │        SignedLinkPort        │
                         │        DemoCatalogPort       │
                         │  Services:                   │
                         │   PenaltyLookupService       │
                         │   (orchestrates use case)    │
                         └──────────┬──────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
    ┌─────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
    │  ADAPTERS IN      │  │  ADAPTERS OUT    │  │  CONFIG          │
    │  (driving)        │  │  (driven)        │  │  BeanConfig      │
    │                   │  │                   │  │  DemoDataConfig  │
    │  web/             │  │  demo/            │  │  (wiring only)   │
    │   PenaltyLookup-  │  │  scraper/         │  └─────────────────┘
    │    Controller     │  │  revenuensw/      │
    │   MediaController │  │  blur/            │
    │   DemoRoutes      │  │  ocr/             │
    │                   │  │  memory/           │
    │                   │  │  azureblob/        │
    │                   │  │  s3/               │
    │                   │  │  stub/             │
    │                   │  │  httpbundle/       │
    └───────────────────┘  └───────────────────┘
```

## Key rules

1. **Domain is pure** — no Spring, no cloud SDK, no adapter imports
2. **Application knows only ports** — never depends on any adapter
3. **Adapters IN never import adapters OUT** — they communicate only through ports
4. **Each adapter is isolated** — Azure adapter doesn't know S3 adapter exists, and vice versa
5. **Demo adapter is just another adapter** — same ports as the real sources; only `DemoDataConfig` knows it exists
6. **Config wires, never decides** — `BeanConfig` picks which adapter to use; business logic stays in the domain

All six rules are enforced by `ArchitectureTest.java` (ArchUnit). A violation breaks the build.

## Packages

| Package | Layer | Responsibility |
|---|---|---|
| `cevoc.domain` | Domain | Value objects, entities, enums. Zero dependencies on anything outside. |
| `cevoc.application.port.in` | Application | Use case interfaces (what the app offers) |
| `cevoc.application.port.out` | Application | Repository/service interfaces (what the app needs) |
| `cevoc.application.service` | Application | Use case implementations |
| `cevoc.adapter.in.web` | Adapter (in) | REST controllers, SSE streaming |
| `cevoc.adapter.out.demo` | Adapter (out) | Demo/fictitious data source |
| `cevoc.adapter.out.scraper` | Adapter (out) | Browser-based Revenue NSW scraper (temporary) |
| `cevoc.adapter.out.revenuensw` | Adapter (out) | HTTP-based Revenue NSW client (temporary) |
| `cevoc.adapter.out.blur` | Adapter (out) | Privacy blur pipeline (Python subprocess) |
| `cevoc.adapter.out.ocr` | Adapter (out) | Camera banner OCR (Tesseract) |
| `cevoc.adapter.out.memory` | Adapter (out) | In-memory media store |
| `cevoc.adapter.out.azureblob` | Adapter (out) | Azure Blob Storage media store |
| `cevoc.adapter.out.s3` | Adapter (out) | AWS S3 media store (placeholder) |
| `cevoc.adapter.out.stub` | Adapter (out) | Bundled sample data for local dev |
| `cevoc.config` | Config | Spring wiring: which adapters are active |

## Frontend

React (Vite) single-page app. Program-specific display is config-driven via `programs.json`:

| File | Purpose |
|---|---|
| `App.jsx` | Entry point, routing, SSE connection |
| `LookupForm.jsx` | Notice number + date + registration form |
| `Notice.jsx` | Results page: steps, evidence, certificates |
| `EvidenceGrid.jsx` | Gallery with thumbnails, zoom, swipe, full-screen |
| `EvidenceVideo.jsx` | Adaptive video player (HLS, byte-range, autoplay) |
| `ProgramDetails.jsx` | Program-specific details section |
| `RedLightVisual.jsx` | Red light signal timeline visualisation |
| `SpeedVisual.jsx` | Speed scale visualisation |
| `programs.json` | Per-program display config (details, switches, messages, explainers) |

## Further reading

- [Ports and adapters](ports-and-adapters.md) — every port and its adapters
- [Blur pipeline](blur-pipeline.md) — how privacy blur works end-to-end
- [Demo system](demo-system.md) — how demo data works as an adapter
- [Extending the system](extending.md) — step-by-step guide for common changes
- [Eval framework](eval-framework.md) — how the probe gates releases
- [Decision records](../decisions/) — every architectural choice with rationale
