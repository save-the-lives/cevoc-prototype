# CEVOC prototype v1.1

Three areas, never mixed:

| Area | URL | For |
|---|---|---|
| Demo hub | `#/demo` (opens first) | Presenter: scenarios, run mode, forced failures, open questions |
| Public site | `#/` | The person who received the notice. No login, no staff entry |
| Staff workspace | `#/staff` | Transport and Revenue NSW officers. Same screen, role decides actions |

## Run
    npm install
    npm run dev
Open http://127.0.0.1:5173

## What's new in 1.1
- One public scenario per camera program (fixed, mobile, red-light, average speed, mobile phone), each with context / pain / job-to-be-done in the hub. Two have video.
- Program-specific "How it was measured" panel (speed bar, signal timeline, A-to-B calculation, person-check steps).
- Evidence gallery: large stage, thumbnails, arrows/swipe/keyboard, view larger, download each, download all.
- Each image/video loads on its own; slow, failed and missing files are handled without blocking the page.
- Run mode: Clean (nothing fails) or Realistic (weighted random: mostly none or one failure; rarely all). Seed + reshuffle for rehearsals. Force specific failures.
- Certificates say Current / Not current (not "met").
- Staff: evidence-first layout, "X of Y checks valid" scorecard on top, metadata loads in the background. Same UI for Transport and Revenue NSW; actions outside your role show as a hand-off.
- Samples dropdown opens from the penalty notice field (amber = prototype only).
- Warmer, plainer public copy.

## Branding
Put official files in `public/brand/` (see README there): `nsw-government.svg`, `transport.svg`, `revenue-nsw.svg`. Text lockups show until then.

## Useful URLs
- `#/staff?from=app&as=jo|morgan|alex|jordan` trusted sign-in from an existing system
- Add `?clean=1` to any URL to hide the demo-hub link for screenshots
- Staff search: press `/` or Cmd/Ctrl+K

All data, images and videos are generated and fictitious. Certificate checks summarise Road Transport Act 2013 ss132/137/138 for prototyping, not legal advice.

## Images and video

The evidence images and the two sample videos are built from a small set of photos in `assets-src/real` by `scripts/make-media.py` (needs Pillow and ffmpeg). Each frame gets a camera data strip and a SAMPLE band, and the number plates are re-lettered to match the fictitious notices, so nothing reads as real evidence. Run `python3 scripts/make-media.py` after changing the photos or the notice details; output goes to `public/assets/media`.

## Staff workflows (prototype)

Revenue NSW and Transport for NSW get different staff experiences from one shared codebase (`src/staff/shell/StaffShell.jsx` picks navigation, title and landing by agency).

- **Revenue NSW | Review support.** Lands on the review queue (default view: my unresolved work). Case workflow: `OPEN → TRIAGE → AWAITING_TRANSPORT → ADVICE_RECEIVED → DECIDED`, with `MORE_INFORMATION_REQUIRED`, `REOPENED` and cancelled requests (`src/lib/workflow.js`). CLOSED is deliberately not a separate state in the prototype: a decision ends the case and can be reopened.
- **Technical requests.** Asking Transport is *not* a decision. Revenue raises a request (category, precise question, evidence summary). The case stays open and owned by Revenue; Transport answers in its technical inbox with advice only; Revenue then makes the final decision. Earlier answered advice for the same camera is shown as "Potentially related technical advice available" so a second similar enquiry may not need another referral. Advice is never applied automatically.
- **Transport for NSW | Technical assurance.** Lands on the technical inbox, with a three-pane technical workbench (problem, camera records, response). Transport cannot uphold or withdraw a customer's fine.
- **Source-system deep link.** `#/staff/case/RV-24026?from=external&src=revenue&ref=RCM-558026&as=sam` opens a case with validation shown first and a route back to `#/source/revenue`. The source system is a simulated stand-in, not an integration.
- **Certificate changes.** Approving a certificate withdrawal notifies Revenue NSW (simulated) of the open cases that rely on it.
- **Targets** (28 and 42 days for Revenue, 5 for Transport) are internal service goals editable in the demo hub, not statutory deadlines.

Known gaps: the demo data set is small (no pagination or virtualised rendering), scatter-plot dots on Insights can overlap and miss the 24px target-size guideline (every case is also reachable from the queue), and screen-reader testing is still manual.

## Operational dashboards (prototype)

Each agency lands on its own live **Operational dashboard** (`#/staff`); trends and analytics sit behind "Trends".

- **Revenue NSW:** tiles (new cases, awaiting decision, awaiting Transport, advice back, at risk, certificate changes) link to filtered queues. *Action required now* lists urgent actionable cases and opens the review workbench directly; *Waiting on Transport* shows request age, assigned team, target response and escalation. Managers also see *Team workload*.
- **Transport for NSW:** tiles (new, unassigned, urgent, near or past target, approvals, possible systemic issues, Revenue cases reached), *Incoming technical requests* (acknowledge in one click) and *Operational exceptions* with their downstream reach.
- **Lifecycle:** Revenue request → Transport acknowledgement → Technical investigation → Advice returned → Revenue resolution, shown on both sides with owner, status, time in state, last activity, next required action, target and escalation. Acknowledged is never shown as answered.
- **Roles:** Revenue (Review officer, Prosecutions officer, Review manager, Operations manager) and Transport (Customer inquiry officer, Adjudication officer, Technical systems advisor, Camera program manager, Technical assurance manager). Managers (`team:manage`) can assign work to others.
- **Events and timeliness (simulated):** state is shared between browser tabs, so a Revenue window and a Transport window update live. Notifications (bell) and "What changed" list events; "Last updated" goes amber when the feed is paused or quiet. Demo hub > Controls can skip the clock forward (to trigger overdue events) and pause the feed.
- **Single sign-on** is a paced, simulated handshake. No agency system is connected anywhere.
