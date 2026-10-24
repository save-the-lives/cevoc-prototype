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
