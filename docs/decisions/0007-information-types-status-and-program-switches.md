# 0007. Information types, per-item status and per-program switches

Status: PROPOSED for the status model and sections (design only, nothing built). DECIDED by the owner (voice, 2026-11-04) for the configuration source (plain file in the repo) and for date-ranged versions. The program lookup (how a notice gets its program) is a recommendation awaiting owner answers.
Date recorded: 2026-11-04
Owner approval: given for the configuration source and date-ranged versions (2026-11-04); pending for the program lookup and the questions below

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

4. Per-program capability configuration, a plain file in the repo read through a port (so a different source is possible later, but none is planned): program -> type -> `{ mode: on | off | not_applicable | not_yet, message }`. The message text for the by-design states lives in this file, per type and program. The fault text is fixed and global so a fault can never be configured to look like a choice.
5. Graceful degradation: each type is fetched and resolved independently. A failing source yields `FAILED` for that type only; the page and the other types still render.
6. Adding a program or type is a configuration change. Code changes only when a new type needs a new port.
7. Where the configuration comes from, and how it is versioned by date, is decided below ("Configuration source", "Date-ranged versions").

## Configuration source (DECIDED by the owner, 2026-11-04)
Per-program configuration is simple. Each enforcement program decides what is on and off, and this rarely changes. So:
- A plain YAML or JSON file kept in the repository, read by the backend at start-up through the configuration port. No database, no admin screen, no feature-flag service.
- Git is the version history. Changing a switch means: edit the file, review it in a pull request, redeploy. Nothing changes at run time.
- An optional `version` field on each program version (a label such as `2026-11-a`) so a result and a log line can say which rules applied.
- Every switch change is noted in a decision record (a short dated record or an addendum to this one: what changed, which program, why, owner approval).
- This replaces the earlier config-source options (see "Options considered"). Adding a program or a type is still a configuration change; code changes only when a new type needs a new port.

### Date-ranged versions (DECIDED by the owner, 2026-11-04)
Rules for a program can change over time, and a notice is judged under the rules in force on the day of the offence. So each program's entry holds a list of versions, each with a start date and an optional end date. The current version has no end date. The app selects the version that covers the OFFENCE DATE of the notice (not today's date, not the lookup date).

Illustrative shape (fictitious program names and dates; not built):

    programs:
      - id: RED_LIGHT_SPEED          # illustrative id
        versions:
          - version: 2024-a
            from: 2024-01-01
            to: 2026-06-30           # inclusive
            types:
              images:       { mode: on }
              certificates: { mode: on }
              video:        { mode: not_applicable, message: "There is no video for this offence." }
          - version: 2026-b
            from: 2026-07-01         # no "to": current version
            types:
              images:       { mode: on }
              certificates: { mode: off, message: "Certificates are not shown for this offence." }
              video:        { mode: not_applicable, message: "There is no video for this offence." }
    mapping:                         # see "Program lookup"
      byOffenceCode:  { ... }
      byCameraCode:   { "7109": RED_LIGHT_SPEED }
      byLocation:     { ... }
      default:        { block: true, message: "We cannot show this information for this notice yet." }

Rules (decided here, to be enforced when built):
1. Both ends are inclusive dates (a version with `to: 2026-06-30` covers that whole day; the next version starts `2026-07-01`).
2. Load-time checks, fail fast: when the file is read at start-up the backend validates every program and refuses to start with a clear message if (a) two versions of one program overlap, (b) there is a gap between consecutive versions of one program, (c) a version has `from` after `to`, (d) more than one version has no end date, or (e) a mode is not one of the known values. Fail fast means a bad edit is caught in the pull request build and at deploy, never by a motorist.
3. The first version's start date is the program's earliest covered date. An offence date before it, or after a closed final version, is "no version covers the date".
4. When no version covers the offence date, the page does not guess and does not hide anything. Each type section shows a plain not-available message under its usual heading, for example "We do not have display rules for an offence on this date, so this information is not shown." It follows the transparency rule: a calm by-design wording, not a fault, `role="status"`, no notice number or raw text in it. The event is logged as a count with the program id only.
5. A test lists, for sample offence dates (each version's first day, last day, the day before the first version, the day after a closed last version, and an open-ended future date), the program and version chosen (or "none"), so a reviewer sees the effect of an edit in the diff.

## Program lookup (how a notice gets its program)
A notice must be matched to a program before any switch applies. The repository has no table from any identifier to a program. Findings from reading the backend code and test fixtures on 2026-11-04 (PROVEN = seen in code or tests; INFERRED = reasoned, not checked against the live site):

Revenue NSW penalty response (`RevenueNswPageParser`, fixtures `fictitious-state*.html`):
- PROVEN: returns `NoticeDetails` with `offenceDescription` (free text such as "Camera recorded" in the fixture), `offenceDate`, `offenceTime`, `location` (free-text street and suburb, "not a code"), `penaltyAmount`, `amountOwing`, `noticeStatus`, `statusMessage`, `enforcementMethod` (`CAMERA`, `OFFICER_ISSUED`, `UNKNOWN`).
- PROVEN: no offence code and no offence type field is returned. `enforcementMethod` is derived: `CAMERA` when the description contains "camera recorded" or once images are seen; otherwise `UNKNOWN`. The manifest stub (fictitious notices 9000000001 to 9000000004) holds `enforcementMethod` per notice directly.
- PROVEN: the page parser also returns `cameraCode` (the image banner's "Camera Code", else the `s=` value of the certificate link; fictitious 7109) but only in the images state, which needs the registration number. In the summary state `cameraCode` is null.
- PROVEN: the image banner parser (`CameraBannerParser`) can read direction, operator, banner location, incident number, lane, banner "Offence" text (the fixture shows "Red light"), speed limit, time since red and yellow light duration, but `RevenueNswPageParser` keeps only the camera code; the banner offence text is read and discarded. Nothing in the API exposes it.
- PROVEN: the public response never carries the camera code (`@JsonIgnore`); the certificate list is the only camera-derived output.
- INFERRED: the real page may show an offence code or number that the fixtures do not model (the markup was inferred from the owner's description; selectors are guesses). Unconfirmed against the live site.

Certificates page (`CertificatePageParser`, fixtures under `scraper/certificates/`):
- PROVEN: the query is a location code plus a date range; the results table returns description, type (the fixture shows values such as "Speed", "Camera", "Calibration"), period, certified date, expiry date and an optional href. No camera code, program, offence code or location comes back from this page. The certificate "type" text is a candidate hint for the program only if real values show it (INFERRED, unchecked).
- PROVEN: the location code sent is the camera code (`LookupPenaltyService` passes `cameraCode`; the owner confirmed the two are equal). So the certificates step depends on the camera code, not the other way round.

Existing mapping code:
- PROVEN: `EnforcementSiteResolver` maps location text to a certificate location code; only the manifest stub exists, it is not wired into the lookup flow, and its own comment says whether a real code is on the penalty page is unconfirmed. There is no camera-code-to-program table anywhere.
- PROVEN: no code, test or fixture mentions bus lane or mobile phone detection offences. The only offences in fixtures are a speed offence, a parking offence, a ticketing offence and a red light offence (all fictitious).

Consequence: for a camera notice, a program can be known from the penalty page's offence text (free text, fragile) or from the camera code (only after the registration number step) or from location text (free text, needs a site register). Before the registration step, only the offence description and the location are available.

Recommendation (PROPOSED): a small mapping in the same configuration file (section `mapping` in the example above), tried in this order:
1. Offence code (or the offence description text, normalised, while no code is exposed). This is first because it is available on the summary page, before any plate step, and is the most direct statement of what the notice is for.
2. Camera code, when the images step has produced one.
3. Location text (case and spacing ignored), through the same file.
4. Default block: if nothing matches, no switch is applied, no type is shown as available on a guess, and each section shows a visible message under its heading (for example "We cannot show this information for this notice yet."). It is a by-design message, logged by count, never silent.
The mapping returns a program id; the version is then chosen by offence date. The lookup sits behind a port (a program resolver), so the TfNSW APIs can later supply the program directly and the file mapping becomes a fallback or is removed, by configuration, in line with record 0003.

## Addendum 2026-11-05 (design only; the owner has not yet confirmed a build)
- Fields available for matching today, re-checked on main (PROVEN): offence description text, location text, enforcement method, and (images state only) the camera code. The banner's own "Offence" text, direction, lane and the rest are parsed and discarded today; record 0009 keeps them in the `details` map, after which the banner offence text can be used as a program hint (question 5 above), still only after the registration step.
- A fourth information type is added to the switch list: `evidence_pack` (record 0011), with its own mode and not-available message, date-ranged like the others. Video stays a placeholder type and is never downloadable.
- Road safety messages (record 0012) live in the same per-program, date-ranged file as an optional `messages` list. Missing fields mean a rule does not fire.
- Per-type status values stay: available, off by choice, not applicable, not yet available, failed. The status model and the config loader are NOT to be built until the owner confirms this design in a later entry.

## Options considered for the configuration source
| Option | What | Outcome |
|---|---|---|
| A | Per-program config file read by the backend; canonical sections with status and message; UI renders only status | KEPT, in its plainest form: a YAML or JSON file in the repo, git as history (decided 2026-11-04) |
| B | Environment-variable flags per type | Rejected: not per program, no per-program messages, config sprawl |
| C | Front-end only flags | Rejected: backend cannot report FAILED consistently, logic leaks into the UI |
| D | Remote feature-flag service (or a database or admin screen) | Rejected: adds a vendor or a component and a run-time change path that is not needed for rules that rarely change; against the cloud-agnostic aim for the MVP |

## Transparency rule (core purpose: keep people informed)
- A type is never silently hidden. When it is not shown, the page shows a plain message in the place where the type would appear, under the same heading, so people see that it exists and why it is not shown.
- By-design messages (choice, not applicable, not yet) read calmly and say it is expected. Example: "Video is not available for this offence."
- A fault message is visibly different (different wording, a distinct tone, a retry action where possible) and says it is a technical problem, not a choice. Example: "We could not load the video just now. This is a technical problem, not a choice. Try again in a few minutes."
- The message is announced to assistive technology (`role="status"`; faults `role="alert"`).
- No raw error text, notice number, plate or page content ever appears in a message.

## Questions for the owner (unknown, not guessed)
1. Program identifier: does the real penalty page show an offence code or number (not only the description text)? If yes, which values map to which program? If only text, is the exact wording stable enough to match on?
2. Is there a maintained table (a site register) from camera code or location to program, and may a version of it be kept in this public repo (it must hold no real codes unless the owner says they are public)?
3. For each program, which types apply and what exact wording should the by-design messages use?
4. Bus lane and mobile phone detection cameras: which rules decide what counts as prima facie or supplementary evidence, which certificates apply, whether images are released with the same registration step, and whether a camera code is printed on their evidence images. Nothing about these is in the repo or in any public source checked, so it is unknown.
5. Is the banner "Offence" text (for example "Red light") reliable enough to use as a program hint when it is present? Today it is read and discarded.
6. What wording should the "no version covers this offence date" and "no program matched" messages use?
7. Until the lookup is built: should an unmatched notice show all types as before, or the visible default block described above? (Recommended: the default block.)

## Ruled out
Silent hiding of unavailable types. Inferring state in the UI from empty lists.
