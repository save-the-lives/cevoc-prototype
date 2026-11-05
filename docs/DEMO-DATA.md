# Demo data (fictitious notices for the prototype)

Everything here is invented: ten-digit notice numbers, places, amounts, plate `TST123`, camera code `7109`, and the sample images. No real notice, person, vehicle or place is used, and nothing is fetched from any network. Decision records: 0007 (information types and status), 0009 (flexible details map), 0010 (route providers), 0013 to 0016 (red light first, default block, video default on).

## The switch (one setting, ON by default during the prototype)

| Setting | Meaning |
|---|---|
| `CEVOC_DEMO_DATA` (property `cevoc.demo-data`) | `true` (the default, in `application.properties`): demo adapter, demo hub and demo images exist. Anything else (`false`): none of it exists. |

- **To turn it off, set `CEVOC_DEMO_DATA=false` in the Container App environment.** That one line is all. Do this **before any real data or any real audience**.
- It is checked in ONE place, `cevoc.config.DemoDataConfig`. Everything demo is a bean of that class. A test fails if any other main source file reads the setting.
- **Off:** no demo adapter is registered, a demo number is an ordinary unknown notice (the same answer as any other unknown number), `/api/demo/cases` and `/api/demo/media/...` are unknown paths (404), and the page `/demo-cases` (alias `/test-cases`) behaves like any unknown page (it shows the normal lookup form). Nothing links to it, and no demo banner can appear.
- **On:** the lookup consults the demo adapter first for a demo number. A demo number is never passed on to a real route. Every page driven by demo data shows the banner "Demo data, not a real notice".
- The live check and the scraper flags are separate, stay off by default and are not touched by this switch.

## Where it plugs in (hexagonal)

- The demo route is another adapter behind the same lookup port (`PenaltyLookupPort`), beside the browser route, the plain HTTP route and the future API route. It returns the same canonical result (typed notice, flexible details map, certificates, status and message), the same step trace and the same progress callbacks. Code: `cevoc.adapter.out.demo`. No production adapter, domain class or controller holds demo logic (ArchUnit rule in `ArchitectureTest`).
- `DemoCaseFactory` is the central place: it parses prefix and sequence (`DemoNumber`), finds the scenario (`DemoScenarios`, the one list) and builds, deterministically, the **text record** (notice fields, the details map with camera code, direction, operator, location, incident number, lane, offence, speed limit, time since red, yellow duration, date and time, and the certificate rows) and, through a `DemoMediaSource`, the **media set** (images, video). They are kept apart like the real flow keeps the details panel and banner text apart from the image list. Today the media source (`SampleMediaSource`) generates simple SVG sample images that say "SAMPLE IMAGE, NOT A REAL PHOTO"; the sample video is the one under `frontend/public/samples`. The next step plugs openly licensed media in behind the same interface.
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

## The demo hub

`/demo-cases` (alias `/test-cases`) lists the cases grouped by program, then happy, partial, sad and edge, each with its ten-digit number, a one-line description, the status per information type, a link that opens the case in the real result page through the demo adapter, and a copy-number button. Reserved programs are listed as "not built yet". The list is served by `GET /api/demo/cases`, which exists only while the switch is on, so the hub and the checks use one list. For cases that need the plate, type `TST123` (or any other plate to see the refusal).

## Visual check

`node scripts/visual-check.mjs` also screenshots the hub and every listed case at 390 px and 1280 px (see `docs/VISUAL-CHECK.md`). It reads `scripts/visual-check-demo-cases.json`, generated from the same list.
