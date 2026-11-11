# Demo system

The demo system provides fictitious camera fine notices for demonstration and testing. It is an **adapter** — the same port interfaces as the real sources, behind a single switch.

## Principle

Demo data is just another adapter on the live hot path. There are no demo-only routes, no demo-specific fallbacks, and no code that branches on a case number. Everything flows through the same controllers, services, and ports as real data.

## Switch

```
CEVOC_DEMO_DATA_ENABLED=true    # On
CEVOC_DEMO_DATA_ENABLED=false   # Off (default)
```

When off, nothing demo-related exists in the running app: no hub page, no demo routes, no demo data.

## Architecture

```
DemoDataConfig (Spring @Configuration)
    └── creates demo beans only when CEVOC_DEMO_DATA_ENABLED=true
        ├── DemoPenaltyLookupAdapter  implements PenaltyLookupPort
        ├── DemoCertificateSource     implements CertificateSourcePort
        ├── DemoRoutes                implements DemoCatalogPort
        ├── DemoSignedLinks           delegates to SignedLinkPort
        └── DemoMediaSource           implements DemoMediaPort
```

## Case data flow

```
DemoScenarios.all()                    Static list of all demo cases
       │
       ▼
DemoCaseFactory.create(scenario)       Builds PenaltyLookupResult from scenario data
       │                               (notice fields, details map, evidence items)
       ▼
DemoPenaltyLookupAdapter              Implements PenaltyLookupPort
       │                               Fires the same SSE progress callbacks as real adapters
       ▼
MediaController                        Shared: serves evidence via signed links
       │                               Video goes through BlurPort (same as live)
       ▼
User sees results                      Identical UI path as real data
```

## Scenario anatomy

Each demo case is defined in `DemoScenarios.java` as a `DemoScenario` with:

| Field | Purpose | Default |
|---|---|---|
| `number` | Case number (e.g. 0000000001) | sequence-based |
| `title` | Display name on hub page | required |
| `description` | What the case demonstrates | required |
| `program` | `DEFAULT` or `RED_LIGHT` | from program group |
| `images` | Number of evidence images | 4 |
| `video` | Whether video is included | true |
| `plate` | `GATED` (needs registration), `NONE`, `NOT_ACCEPTED` | `GATED` |
| `certs` | Certificate availability | `COVERING` |
| `details` | Detail completeness: `FULL`, `SOME_MISSING`, `NONE` | `FULL` |
| `outcome` | `FOUND`, `NOT_FOUND`, `TIMEOUT`, `IMAGES_FAIL` | `FOUND` |
| `shape` | `NORMAL`, `EXTREME_VALUES`, `UNKNOWN_PROGRAM_TEXT` | `NORMAL` |

The scenario **data** drives all behaviour. The code is generic.

## Adding a new demo case

1. Add a line in `DemoScenarios.all()`:
   ```java
   out.add(s(p, 106).title("My new case", "Description").images(2).video(false));
   ```
2. The case number is derived from the program offset + the sequence number
3. `DemoCaseFactory` generates the notice details, evidence items, and certificates from the scenario
4. No other code changes needed — the factory is generic

## Adding a new program to demo data

1. Add a `DemoProgram` enum value
2. Add cases for it in `DemoScenarios.all()` under a program group
3. Add program-specific detail fields in `DemoCaseFactory.detailsMap()`
4. Add a program config in `frontend/src/programs.json` with match rules and display details
5. Optionally add a visual component (like `RedLightVisual.jsx` or `SpeedVisual.jsx`)

## Media sources

| Source | When used | Content |
|---|---|---|
| `SampleMediaSource` | No bundle URL configured | Generated SVG placeholder images |
| `BundleMediaSource` | Bundle URL configured | Real-looking images from a hosted bundle |
| Static files | `frontend/public/samples/` | Video files and photo-realistic images with camera banners |

Video always goes through `MediaController` → `BlurPort` — the same path as live evidence. Images are served directly (they are pre-blurred in the sample files).
