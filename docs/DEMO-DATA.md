# Demo data (fictitious notices for the prototype)

Everything here is invented: ten-digit notice numbers, places, amounts, plate `TST123`, camera code `7109`, and the sample images. No real notice, person, vehicle or place is used, and by default nothing is fetched from any network (only if an optional demo content bundle URL is configured, see below). Decision records: 0007 (information types and status), 0009 (flexible details map), 0010 (route providers), 0013 to 0016 (red light first, default block, video default on).

## The switch (one setting, OFF by default)

| Setting | Meaning |
|---|---|
| `CEVOC_DEMO_DATA_ENABLED` (property `cevoc.demo-data.enabled`) | Only the lowercase word `true` turns it on: demo adapter, demo hub and demo images exist. Unset, or anything else (`false`, `TRUE`, `1`): none of it exists. The default (in `application.properties`) is off. |

The old name `CEVOC_DEMO_DATA` (property `cevoc.demo-data`) is retired, with no fallback and no alias: it is ignored if still present.

- **To turn it on, set `CEVOC_DEMO_DATA_ENABLED=true` in the Container App environment.** That one line is all. Never leave it on **with real data or a real audience**; to turn it off, remove the setting or set it to anything but `true`.
- It is checked in ONE place, `cevoc.config.DemoDataConfig`. Everything demo is a bean of that class. A test fails if any other main source file reads the setting.
- **Off:** no demo adapter is registered, a demo number is an ordinary unknown notice (the same answer as any other unknown number), `/api/demo/cases` and `/api/demo/media/...` are unknown paths (404), and the page `/demo-cases` (alias `/test-cases`) behaves like any unknown page (it shows the normal lookup form). Nothing links to it, and no demo banner can appear.
- **On:** the lookup consults the demo adapter first for a demo number. A demo number is never passed on to a real route. Every page driven by demo data shows a small purple "Demo data" tag at the right-hand end of the NSW Government header (no extra row, so the layout matches the real page).
- The live check and the scraper flags are separate, stay off by default and are not touched by this switch.

## Where it plugs in (hexagonal)

- The demo route is another adapter behind the same lookup port (`PenaltyLookupPort`), beside the browser route, the plain HTTP route and the future API route. It returns the same canonical result (typed notice, flexible details map, certificates, status and message), the same step trace and the same progress callbacks. Code: `cevoc.adapter.out.demo`. No production adapter, domain class or controller holds demo logic (ArchUnit rule in `ArchitectureTest`).
- `DemoCaseFactory` is the central place: it parses prefix and sequence (`DemoNumber`), finds the scenario (`DemoScenarios`, the one list) and builds, deterministically, the **text record** (notice fields, the details map with camera code, direction, operator, location, incident number, lane, offence, speed limit, time since red, yellow duration, date and time, and the certificate rows) and, through a `DemoMediaSource`, the **media set** (images, video). They are kept apart like the real flow keeps the details panel and banner text apart from the image list. Today the media source (`SampleMediaSource`) generates simple SVG sample images that say "SAMPLE IMAGE, NOT A REAL PHOTO"; the sample video is the one under `frontend/public/samples`. With a demo content bundle configured (below) the same interface serves the bundle's media instead, and `DemoContentGate` decides which, and whether demo content is available at all.
- Failure conditions are part of the scenario and are played out by the adapter: timeout, not found, image failure, certificate failure, plate refused.
- The offence date typed into the form is not compared: each case carries its own date (shown on the page and in the hub).

## Number scheme

A demo notice number is **ten digits**: the first six are the program prefix, the last four the sequence.

| Prefix | Program | State |
|---|---|---|
| `000000` | Default block (program not configured) | built |
| `100000` | Red light | built |
| `200000` | Fixed speed | reserved, not built yet |
| `300000` | Mobile speed | reserved, not built yet |
| `400000` | Average speed | reserved, not built yet |
| `500000` | Mobile phone detection | reserved, not built yet |
| `600000` | Bus lane | reserved, not built yet |

| Sequence | Kind | Meaning |
|---|---|---|
| `0001` to `0099` | Happy | Everything returned: images, a certificate covering the offence date, program details, and a video |
| `0100` to `0199` | Partial | Certificate missing or not covering the date, video not returned, some program fields not returned, one image only, notice paid or in review |
| `0200` to `0299` | Sad | Certificate technical failure, image failure, details missing entirely, timeout, notice not found, wrong plate behaviour |
| `0300` and up | Edge | Offence date outside any configuration version, unknown program falling to the default block, very long location text, extreme values, road safety trigger thresholds just under, at and over |

A number inside a range that is not listed below behaves like the first case of its range (happy `0001`, partial `0101`, sad `0201`, edge `0301`) for that program. A number with a reserved prefix, an unknown prefix, sequence `0000`, or any other shape is not a demo number: it is passed on to the normal route as any other number. The older fictitious `9000000001` to `9000000009` (manifest) are unchanged.

### Can a demo number clash with a real notice number?

Checked against this repository: the only constraints on a real number found in the code are that the lookup accepts 4 to 20 letters, digits, spaces or dashes (`PenaltyLookupController`) and the browser route 4 to 20 letters or digits. No source here states the real format, no real number is held anywhere, and the owner's description does not say it. So a clash **cannot be ruled out from this repository**: a real ten-digit number that starts with `000000` or with `100000` to `600000` followed by `00` and a sequence under 1000 would be answered by the demo adapter while the switch is on. That is why the switch is on only during the prototype, why every demo answer carries the banner, and why it must be turned off before real data. If the owner confirms that real numbers can be ten digits, add a marker real numbers cannot have (for example a leading letter) in `DemoNumber.parse`, the one place that reads the scheme.

## Scenario table

Status words in the table: *Shown* (all of it returned), *Shown in part*, *Not returned, said plainly* (the page says it was not returned; video says "not available yet"), *Held back until the number plate is given*, *Technical failure, said plainly* (distinct wording, never presented as a choice), *No display rules, default message* (the default block's plain message), *No notice, nothing to show*. They follow the transparency rule of record 0007: nothing is hidden silently. A test runs every case through the real lookup service and fails when what is returned differs from the status declared here, so this table cannot go stale.

<!-- BEGIN GENERATED: scenario table (DemoArtifacts, do not edit by hand) -->

### 000000 Default block

| Number | Kind | What it shows | Images | Certificates | Video | Program details |
|---|---|---|---|---|---|---|
| `0000000001` | Happy | **Everything returned.** Three images, a certificate covering the offence date, and a video. | Shown | Shown | Shown | No display rules, default message |
| `0000000002` | Happy | **Everything returned, evening.** Same as 0001 for an evening offence at a different place. | Shown | Shown | Shown | No display rules, default message |
| `0000000101` | Partial | **No certificate returned.** Images and video are there; the certificate list is empty. | Shown | Not returned, said plainly | Shown | No display rules, default message |
| `0000000102` | Partial | **Certificate does not cover the date.** A certificate is listed but none was in force on the offence date. | Shown | Shown in part | Shown | No display rules, default message |
| `0000000103` | Partial | **No video returned.** Images and a covering certificate; no video. | Shown | Shown | Not returned, said plainly | No display rules, default message |
| `0000000105` | Partial | **One image only.** A single image instead of three; no video. | Shown in part | Shown | Not returned, said plainly | No display rules, default message |
| `0000000106` | Partial | **Images need the number plate.** Images and video are held back until the plate TST123 is given. | Held back until the number plate is given | Shown | Held back until the number plate is given | No display rules, default message |
| `0000000107` | Partial | **Notice already paid.** Everything returned; the notice is paid and nothing is owing. | Shown | Shown | Shown | No display rules, default message |
| `0000000108` | Partial | **Notice in review.** Everything returned; the notice is under review. | Shown | Shown | Shown | No display rules, default message |
| `0000000201` | Sad | **Certificate lookup failed.** Images and video are there; the certificate lookup has a technical failure. | Shown | Technical failure, said plainly | Shown | No display rules, default message |
| `0000000202` | Sad | **Image retrieval failed.** The notice is found, then the image step fails; images, certificates and video are reported failed. | Technical failure, said plainly | Technical failure, said plainly | Technical failure, said plainly | No display rules, default message |
| `0000000204` | Sad | **Source timed out.** The source does not answer in time; no details at all. | Technical failure, said plainly | Technical failure, said plainly | Technical failure, said plainly | Technical failure, said plainly |
| `0000000205` | Sad | **Notice not found.** The source does not know this notice. | No notice, nothing to show | No notice, nothing to show | No notice, nothing to show | No notice, nothing to show |
| `0000000206` | Sad | **Wrong plate, always refused.** Images are held back and every number plate is refused, so the page says so. | Held back until the number plate is given | Shown | Held back until the number plate is given | No display rules, default message |
| `0000000301` | Edge | **Offence date before any configuration version.** Dated 31 Dec 1999; the default block never fails and is used as always. | Shown | Shown | Shown | No display rules, default message |
| `0000000303` | Edge | **Very long location text.** The location is about 300 characters long. | Shown | Shown | Shown | No display rules, default message |
| `0000000304` | Edge | **Extreme values.** Penalty $99,999.99, offence at 23:59:59. | Shown | Shown | Shown | No display rules, default message |

### 100000 Red light

| Number | Kind | What it shows | Images | Certificates | Video | Program details |
|---|---|---|---|---|---|---|
| `1000000001` | Happy | **Everything returned.** Three images, a certificate covering the offence date, all red light details, and a video. | Shown | Shown | Shown | Shown |
| `1000000002` | Happy | **Everything returned, evening.** Same as 0001 for an evening offence at a different place. | Shown | Shown | Shown | Shown |
| `1000000101` | Partial | **No certificate returned.** Images and video are there; the certificate list is empty. | Shown | Not returned, said plainly | Shown | Shown |
| `1000000102` | Partial | **Certificate does not cover the date.** A certificate is listed but none was in force on the offence date. | Shown | Shown in part | Shown | Shown |
| `1000000103` | Partial | **No video returned.** Images and a covering certificate; no video. | Shown | Shown | Not returned, said plainly | Shown |
| `1000000104` | Partial | **Some red light details not returned.** The seconds after red are there; the speed limit is not. | Shown | Shown | Shown | Shown in part |
| `1000000105` | Partial | **One image only.** A single image instead of three; no video. | Shown in part | Shown | Not returned, said plainly | Shown |
| `1000000106` | Partial | **Images need the number plate.** Images and video are held back until the plate TST123 is given. | Held back until the number plate is given | Shown | Held back until the number plate is given | Shown |
| `1000000107` | Partial | **Notice already paid.** Everything returned; the notice is paid and nothing is owing. | Shown | Shown | Shown | Shown |
| `1000000108` | Partial | **Notice in review.** Everything returned; the notice is under review. | Shown | Shown | Shown | Shown |
| `1000000201` | Sad | **Certificate lookup failed.** Images and video are there; the certificate lookup has a technical failure. | Shown | Technical failure, said plainly | Shown | Shown |
| `1000000202` | Sad | **Image retrieval failed.** The notice is found, then the image step fails; images, certificates and video are reported failed. | Technical failure, said plainly | Technical failure, said plainly | Technical failure, said plainly | Not returned, said plainly |
| `1000000203` | Sad | **Details missing entirely.** Images, certificate and video are there; no red light details at all. | Shown | Shown | Shown | Not returned, said plainly |
| `1000000204` | Sad | **Source timed out.** The source does not answer in time; no details at all. | Technical failure, said plainly | Technical failure, said plainly | Technical failure, said plainly | Technical failure, said plainly |
| `1000000205` | Sad | **Notice not found.** The source does not know this notice. | No notice, nothing to show | No notice, nothing to show | No notice, nothing to show | No notice, nothing to show |
| `1000000206` | Sad | **Wrong plate, always refused.** Images are held back and every number plate is refused, so the page says so. | Held back until the number plate is given | Shown | Held back until the number plate is given | Shown |
| `1000000301` | Edge | **Offence date before any configuration version.** Dated 31 Dec 1999, before the first display rules; the page says it has no rules for that date. | Shown | Shown | Shown | No display rules, default message |
| `1000000302` | Edge | **Unknown program falls to the default block.** Camera notice whose offence text and details match no program, so the default block shows. | Shown | Shown | Shown | No display rules, default message |
| `1000000303` | Edge | **Very long location text.** The location is about 300 characters long. | Shown | Shown | Shown | Shown |
| `1000000304` | Edge | **Extreme values.** Penalty $99,999.99, offence at 23:59:59, 59.9 seconds after red, speed limit 130. | Shown | Shown | Shown | Shown |
| `1000000305` | Edge | **Time after red just under 1.0 s.** 0.9 seconds after red, just under the illustrative late-red threshold. | Shown | Shown | Shown | Shown |
| `1000000306` | Edge | **Time after red exactly 1.0 s.** 1.0 seconds after red, exactly at the threshold. | Shown | Shown | Shown | Shown |
| `1000000307` | Edge | **Time after red just over 1.0 s.** 1.1 seconds after red, just over the threshold. | Shown | Shown | Shown | Shown |
| `1000000308` | Edge | **Offence at 19:59, just before night.** Just under the illustrative night threshold of 20:00. | Shown | Shown | Shown | Shown |
| `1000000309` | Edge | **Offence at 20:00, night starts.** Exactly at the night threshold. | Shown | Shown | Shown | Shown |
| `1000000310` | Edge | **Offence at 20:01, just into night.** Just over the night threshold. | Shown | Shown | Shown | Shown |

### 200000 Fixed speed (not built yet)

Reserved, not built yet. The prefix is reserved: the sequence ranges below apply when it is built.

### 300000 Mobile speed (not built yet)

Reserved, not built yet. The prefix is reserved: the sequence ranges below apply when it is built.

### 400000 Average speed (not built yet)

Reserved, not built yet. The prefix is reserved: the sequence ranges below apply when it is built.

### 500000 Mobile phone detection (not built yet)

Reserved, not built yet. The prefix is reserved: the sequence ranges below apply when it is built.

### 600000 Bus lane (not built yet)

Reserved, not built yet. The prefix is reserved: the sequence ranges below apply when it is built.

<!-- END GENERATED -->

To refresh the table and the visual check fixture after changing `DemoScenarios`: `cd backend && mvn -q test -Dtest=DemoArtifactsTest -Dcevoc.demo.regenerate=true`, then commit both files. The test fails without that when they differ.

## Demo content bundle (separate from the app image)

Decision record: `docs/decisions/0018-demo-bundle-delivery.md`. The media list and licences: `docs/DEMO-MEDIA.md` and `docs/demo-media-manifest.json`. The scenario table above is generated and has no media columns; which media and licence each case uses is in `DEMO-MEDIA.md` ("Which case uses which media"): every case with images uses the image set of the active media source, picked by sequence number, all project-original today.

### GitHub Release limits (record of what was checked)

Not verified from the build sandbox: the GitHub documentation pages could not be fetched (access to `docs.github.com` was not granted), and a search returned titles only. The understanding recorded here, from the owner and from memory of GitHub's "About releases" page, is: each release asset may be up to 2 GiB; there is no stated limit on the number of assets or on total release size; there is no stated download bandwidth cap for normal use. **To check before relying on it:** open https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases and look for the file size and bandwidth wording. Anonymous downloads are subject to GitHub's general abuse and rate limiting, which an occasional app start does not approach. The bundle is designed to stay in the tens of MB (the build script refuses more than 60 MB of content, 3 MB per image, 15 MB per video; the loader refuses more than 100 MB).

### What is in a bundle

One zip: `bundle.json` (bundle version and, for every file, size, SHA-256, licence, licence URL, author, credit, source), `media/` (images, video) and `text/` (banner lines per media file, credits). The two payloads stay separate. Banner text is text, not baked into pictures.

### Build, publish, point the app at it

1. **Build locally (any time):** `node scripts/build-demo-bundle.mjs` writes `dist/cevoc-demo-bundle-<version>.zip` and a `.sha256` file and prints the checksum. It reads `docs/demo-media-manifest.json`, downloads each file from its recorded source (a `repo:` path or an https URL), **refuses any file without a recorded source, author, licence, licence URL and passed privacy check**, checks sizes, and is deterministic (the same inputs give the same checksum).
2. **Publish:** run the manual workflow "Demo bundle (manual)" (`.github/workflows/demo-bundle.yml`, workflow_dispatch only). It builds the bundle and attaches the zip and the `.sha256` to a release tagged `demo-bundle-<bundleVersion>`. It refuses to overwrite an existing release: bump `bundleVersion` in the manifest for new content. (Not run as part of this change; no release exists yet.)
3. **Point the app at it** (Container App environment settings, all three together):

| Setting | Meaning |
|---|---|
| `CEVOC_DEMO_BUNDLE_URL` | The https URL of the zip, for example the release asset's download URL. Empty or unset: built-in sample content, nothing fetched (the default). |
| `CEVOC_DEMO_BUNDLE_VERSION` | The expected `bundleVersion` (for example `1`). Must equal the one inside the bundle. |
| `CEVOC_DEMO_BUNDLE_SHA256` | The expected SHA-256 of the zip, from the `.sha256` file. |

Optional tuning (properties `cevoc.demo-bundle.timeout-seconds`, default 60, and `cevoc.demo-bundle.retry-minutes`, default 10) has no environment setting wired by default.

### Behaviour and fail safe

- Switch on, no URL: built-in sample content (the least surprising: an unconfigured deployment behaves as before).
- Switch on, URL set: the bundle is fetched lazily on the first demo use by plain HTTPS (no credentials, https only, size capped), then verified: archive checksum, bundle version, every file's size and checksum, licence, author and credit on every file, no unlisted file, no unsafe file name. Video is extracted from the archive only when a case asks for it.
- Any failure: demo content is unavailable. A demo number is passed to the normal route like any other number, `/api/demo/cases` answers `available: false` with an empty list and the hub page says "Demo content is not available right now. Real lookups are not affected.", media paths answer 404, and one warning is logged (the reason, never the URL). The app starts and serves real lookups regardless. After the cool-down the next demo use tries again.
- Switch off (the default, `CEVOC_DEMO_DATA_ENABLED` unset or not `true`): nothing demo exists and nothing is fetched, whatever the bundle settings say.
- **One line to turn demo mode on:** `CEVOC_DEMO_DATA_ENABLED=true` on the Container App. Off is the default.

## The demo hub

`/demo-cases` (alias `/test-cases`) lists the cases grouped by program, then happy, partial, sad and edge, each with its ten-digit number, a one-line description, the status per information type, a link that opens the case in the real result page through the demo adapter, and a copy-number button. Reserved programs are listed as "not built yet". The list is served by `GET /api/demo/cases`, which exists only while the switch is on, so the hub and the checks use one list. For cases that need the plate, type `TST123` (or any other plate to see the refusal).

## Visual check

`node scripts/visual-check.mjs` also screenshots the hub and every listed case at 390 px and 1280 px (see `docs/VISUAL-CHECK.md`). It reads `scripts/visual-check-demo-cases.json`, generated from the same list.
