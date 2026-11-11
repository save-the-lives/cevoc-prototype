# Eval-driven development framework

The demo probe is structured as an **evaluator-optimizer** pattern (Anthropic's term) or **eval-driven development** framework. It is not just a test suite — it is the gate that decides whether a change goes live.

## Pattern

```
Developer pushes code
       │
       ▼
┌──────────────┐
│ CI BUILD      │  compile, unit tests, ArchUnit
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ DEPLOY        │  container image → staging / preview
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ EVAL FRAMEWORK (demo-probe)              │
│                                          │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │ FUNCTIONAL   │  │ PRIVACY          │   │
│  │ Pages load   │  │ Plate leak check │   │
│  │ Forms work   │  │ Face blur check  │   │
│  │ Evidence     │  │ Offending plate  │   │
│  │  renders     │  │  stays readable  │   │
│  └─────────────┘  └─────────────────┘   │
│                                          │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │ VISUAL       │  │ BANNER OCR       │   │
│  │ Screenshots  │  │ Location text    │   │
│  │ per case     │  │ Timestamp        │   │
│  │ (artifacts)  │  │ Speed / timing   │   │
│  └─────────────┘  └─────────────────┘   │
│                                          │
│  Result: PASS or FAIL                    │
└──────────────────┬───────────────────────┘
                   │
          ┌────────┴────────┐
          │                 │
     ┌────▼────┐      ┌────▼────┐
     │  PASS    │      │  FAIL    │
     │ → live   │      │ → block  │
     │ traffic  │      │ → issue  │
     └─────────┘      └─────────┘
```

## Test categories

### Functional (every demo case)

- **Page loads**: navigates to `/?demo=<number>`, verifies step sections render
- **Evidence loads**: waits for media cards (images/thumbnails), verifies count > 0
- **Video plays**: checks video element has src, attempts muted playback

### Privacy (every case with video)

- **Plate leak check**: downloads blurred video, runs YOLO plate detection on every frame (threshold 0.10), skips offending plate region by IoU. Any non-offending plate detected = FAIL.
- **Frame grid**: generates composite PNG (every 10th frame, 3 columns) with any leaks highlighted in red. Uploaded as GitHub Actions artifact.

### Banner OCR (every case with images)

- **Banner text readability**: downloads evidence image, analyses top/bottom banner strips for text-like content density. Speed cases check for location + speed/limit. Red light cases check for location + signal timing.

### Visual (all cases)

- **Full-page screenshots**: captured for every case, uploaded as artifacts for human review. Not compared automatically (no baseline yet).

## Files

| File | Purpose |
|---|---|
| `.github/demo-probe/demo-probe.spec.js` | Playwright test spec — all test categories |
| `.github/demo-probe/check_blur_leaks.py` | Python: frame-by-frame plate leak detection |
| `.github/demo-probe/check_banner_ocr.py` | Python: banner text readability analysis |
| `.github/demo-probe/playwright.config.js` | Playwright configuration |
| `.github/workflows/demo-probe.yml` | GitHub Actions workflow: schedule, post-deploy, manual |

## Triggers

| Trigger | When |
|---|---|
| Hourly schedule | `:42` past every hour |
| Post-deploy | After successful backend deploy workflow |
| Manual | `workflow_dispatch` from GitHub Actions |

## Failure handling

- **GitHub issue**: opened automatically on failure, closed on recovery
- **Screenshots and frame grids**: uploaded as workflow artifacts (7-day retention)
- **Exit code**: Playwright returns non-zero on any test failure → workflow fails → deploy is not promoted

## Extending the eval

To add a new check:

1. Add a test block in `demo-probe.spec.js` (follow the existing pattern of iterating `allCases`)
2. For Python-based checks, add a script in `.github/demo-probe/` with exit codes: 0 = pass, 1 = fail, 2 = setup error
3. If the check needs new dependencies, add them to the "Install" step in `demo-probe.yml`
4. Take screenshots or generate artifacts for human review

## Future: visual regression

The framework is structured to support visual regression testing:
1. Establish baseline screenshots from a known-good deploy
2. Compare new screenshots pixel-by-pixel (or perceptually)
3. Flag visual regressions as test failures

This requires a baseline storage mechanism (e.g. S3 bucket or Git LFS) and a comparison tool (e.g. pixelmatch, reg-suit).
