# 0007. Information types, per-item status and per-program switches

Status: PROPOSED. Design and recommendation only. Nothing is built until the owner picks.
Date recorded: 2026-11-04
Owner approval: pending (owner to pick an option below)

## Question
The app surfaces different types of information. How do we turn images, certificates and video on and off per enforcement program (fixed speed and red light, mobile phone detection, bus lane, others), and never hide a type silently?

## Information types
- `IMAGES` (evidence images): real today.
- `CERTIFICATES`: real, via the certificate providers.
- `VIDEO`: placeholder type only. The legacy site has no video, so no adapter is built or wired. The model and the configuration know the type so a message can be shown.

## Design (recommended)
1. One outbound port per information type (`EvidenceImagePort`, `CertificateSourcePort` already exists, `EvidenceVideoPort` placeholder with no adapter). Providers (Revenue NSW, the TfNSW certificates page, later TfNSW APIs) plug in behind them.
2. A provider-agnostic canonical result. For each type the result carries a section: `{ type, status, message, items[] }`. The UI renders only `status`, `message` and `items`. It never infers a state from missing data.
3. Statuses:

| Status | Meaning | Kind |
|---|---|---|
| `AVAILABLE` | Items are present | normal |
| `OFF_BY_CHOICE` | Switched off for this program by configuration | by design |
| `NOT_APPLICABLE` | This program does not have this type | by design |
| `NOT_YET_AVAILABLE` | Planned but no source yet (video today) | by design |
| `FAILED` | Expected, but could not be retrieved (timeout, source down, parse failure) | fault |

4. Per-program capability configuration, a data file read through a port (so it can later come from any store): program -> type -> `{ mode: on | off | not_applicable | not_yet, message }`. The message text for the by-design states lives in this file, per type and program. The fault text is fixed and global so a fault can never be configured to look like a choice.
5. Graceful degradation: each type is fetched and resolved independently. A failing source yields `FAILED` for that type only; the page and the other types still render.
6. Adding a program or type is a configuration change. Code changes only when a new type needs a new port.

Example configuration shape (illustrative, not built):

    {
      "MOBILE_PHONE": {
        "images":       { "mode": "on" },
        "certificates": { "mode": "on" },
        "video":        { "mode": "not_yet", "message": "Video is not available for phone detection offences yet." }
      },
      "BUS_LANE": {
        "video":        { "mode": "not_applicable", "message": "There is no video for bus lane offences." }
      }
    }

## Transparency rule (core purpose: keep people informed)
- A type is never silently hidden. When it is not shown, the page shows a plain message in the place where the type would appear, under the same heading, so people see that it exists and why it is not shown.
- By-design messages (choice, not applicable, not yet) read calmly and say it is expected. Example: "Video is not available for this offence."
- A fault message is visibly different (different wording, a distinct tone, a retry action where possible) and says it is a technical problem, not a choice. Example: "We could not load the video just now. This is a technical problem, not a choice. Try again in a few minutes."
- The message is announced to assistive technology (`role="status"`; faults `role="alert"`).
- No raw error text, notice number, plate or page content ever appears in a message.

## Options for the owner to pick

| Option | What | Pros | Cons |
|---|---|---|---|
| A (recommended) | Per-program config file read by the backend; canonical sections with status and message; UI renders only status | Matches hexagonal design; data not code; one source of truth; testable | Needs a program identifier on each notice (see questions) |
| B | Environment-variable flags per type | Quick | Not per program; no per-program messages; config sprawl |
| C | Front-end only flags | No backend change | Backend cannot report FAILED consistently; logic leaks into UI; cannot share across clients |
| D | Remote feature-flag service | Change without deploy | Adds a vendor and a dependency; against cloud-agnostic aim for the MVP |

## Questions for the owner (unknown, not guessed)
1. Where does the program (fixed speed, red light, mobile phone, bus lane, others) come from for a notice? Today the backend knows only `CAMERA` or `OFFICER_ISSUED` and a camera code; a camera-code to program table is not in the repo.
2. For each program, which types apply, and what exact wording should the by-design messages use?
3. Camera-program rules (what counts as prima facie versus supplementary evidence for mobile phone detection and bus lane cameras, which certificates apply): not found in the repo or public sources checked, so unknown.

## Ruled out
Silent hiding of unavailable types. Inferring state in the UI from empty lists.
