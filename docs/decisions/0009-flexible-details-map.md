# 0009. Every returned field travels as a flexible details map

Status: ACCEPTED as direction by the owner (voice, 2026-11-05); the audit below is PROVEN by reading the code on main (ece28b4) unless marked INFERRED. Building it is tracked on its own branch and is not merged until backend tests are green.
Date recorded: 2026-11-05
Owner approval: decision given by voice 2026-11-05 (keep all scraped fields as flexible JSON; promote to typed fields only when stable)

## Question
The Revenue NSW page shows program-specific facts (seconds after red, lane, direction, operator, speed limit, yellow duration, incident number). Which of them does the app keep today, and how do we stop losing them?

## Audit: what happens to each banner field today (PROVEN)
`CameraBannerParser` reads twelve labelled fields from the banner text. `RevenueNswPageParser` is the only caller, so it is wired into the live route (adapter `browser`, formerly `scraper-evidence`). It calls the parser only inside `bannerCameraCode` and keeps the camera code alone.

| Field | Parsed | Kept in the result | In the API response | Shown on the page |
|---|---|---|---|---|
| camera code | yes | yes, `PenaltyLookupResult.cameraCode` (banner first, else the `s=` value of the certificate link) | no (`@JsonIgnore`) | no (used as the certificates Location code) |
| direction | yes | no | no | no |
| operator | yes | no | no | no |
| location (banner) | yes | no (the page's own Location row is `NoticeDetails.location`, a different source) | no | the page row only |
| incident number | yes | no (also read from the certificate link, then dropped) | no | no |
| lane | yes | no | no | no |
| offence (banner text) | yes | no | no | no (offence text on the page comes from the summary) |
| speed limit | yes | no | no | no |
| time since red | yes | no | no | no |
| yellow light duration | yes | no | no | no |
| date, time (banner) | yes | no | no | no (page uses the summary's date and time) |

So the red light timing is parsed and then discarded before the result is built. There is no separate "API route" adapter in the code yet: the public JSON response (`PenaltyLookupResult`) is where the fields are lost, and a future Revenue NSW JSON adapter would face the same gap. INFERRED: the JSON summary also carries `offence.demerit.points`, `offence.location{street,suburb}` and image identifiers; none of those are kept as a map either.

## Decision
1. The result gets one more member, `details`: a map from a stable key to a value (string, number or boolean), attached by every route (Chromium, plain HTTP, future APIs). Absent or empty means "nothing returned" and is not serialised.
2. The typed common core stays as it is (status, offence date and time, images, certificates, camera code, program). Everything else a source returns goes into `details`. A field becomes a typed field only when the owner has collected enough cases to show it is stable.
3. Key names: lower camel case taken from the source label (`timeSinceRed`, `yellowLightDuration`, `lane`, `direction`, `operator`, `incidentNumber`, `speedLimit`, `offenceText`, `bannerLocation`); keys from other sources are prefixed with the provider id when they would clash. The front end ignores keys it does not know.
4. Values are exactly as read (trimmed, length-capped). Units stay inside the text ("3.2 seconds"); a reading that is needed numerically (rules, PDF) is parsed at the point of use, and a value that does not parse means the rule or display shows "not available".
5. The registration number is never put in `details`. The `details` map is held in memory for the request only (or in the existing short-lived cache, with its short TTL), never logged, written to a fixture, committed or put in a workflow summary.
6. Diagnostics are structure only: a redacted line such as `details keys=7` plus the sorted key names (names come from a fixed whitelist of known labels; any other key prints as `?`). Never values.
7. Fixture capture for the owner's test cases: the live check prints, per run, the program (once known) and the value-free key list. The owner supplies cases by sending these key lists; tests are built from fictitious values with the same keys.

## Why a map and not more typed fields
Programs differ (red light timing, average speed points, phone detection fields, bus lane). A typed field per fact would change the core for every program. A map lets the per-program configuration (0007) say which keys to show and how to label them, so adding a program is configuration and a display mapping.

## Ruled out
- Typed fields for every banner label now (premature, programs are not all collected).
- Logging or fixture-recording raw JSON to learn the shapes (public repo, real data).
- Dropping fields the page does not show yet (the loss this record fixes).

## Red light page (build-out from the mockup, 0007 and this record)
The mockup (prototype/src/public/Measure.jsx) shows, for red light: a signal sequence graphic, the sentence "The light had been red for N seconds when the vehicle crossed the stop line, travelling at S km/h", a speed scale against the limit, the site name and heading, and teaching cards ("Two checks in one", "Photos at each moment", "Amber is not red"). It does not show lane, yellow duration, operator or incident number, and the amber length in its graphic is a hard-coded 4 seconds, not data. Plan for the working app: render the `details` keys named by the red light block of the program configuration (`timeSinceRed`, `yellowLightDuration`, `lane`, `direction`, `speedLimit`, `bannerLocation`, `incidentNumber`), each with a label from the configuration and a plain "not returned for this notice" line when absent. The signal graphic uses the real yellow duration when present and is not drawn when it is absent. Mockup content that needs the owner's decision: the "Amber is not red" wording, the hard-coded 4 s amber, and the "Two checks in one" card (assumes a combined red light and speed camera).

## Update 2026-11-05 (banner facts, minimal)
Where the fields stopped (PROVEN by reading main 08dcd59): `RevenueNswPageParser.bannerDetails` only looked inside `figcaption, .banner`, while the camera code also falls back to the page text, so the code flowed and the rest stayed empty whenever the real markup was not one of those two. The plain HTTP route never reads a banner at all (its image calls return JPEG bytes; no banner source is known there).
Now: the first image's banner is read (elements first, else the text from the first "Camera Code" to the next), each field on its own, and only what the mockup shows is carried, as numbers: `timeSinceRed` (seconds) and `speedLimit` (km/h). Lane, direction, operator, incident number, yellow duration and the rest are still parsed by `CameraBannerParser` but not carried until the page shows them. The page hides a missing fact, and hides the whole "Red light camera details" section when none is present.

## Update 2026-11-05 (missing facts are said, not hidden)
A visual check of the result page (docs/VISUAL-CHECK.md) found that a red light notice whose details lacked a configured fact showed nothing for it, and showed no section at all when none was returned. That contradicts the plan above and the transparency rule in 0007. The page now shows each configured fact, with "Not returned for this notice" where the notice did not return it. Details are shown only after the certificates part has arrived, so the message cannot flash before the details do. The owner asked for this behaviour when briefing the visual check.
