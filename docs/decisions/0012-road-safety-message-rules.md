# 0012. Road safety messages: rule structure (PROPOSAL, waiting for the owner)

Status: PROPOSED (rule structure). Discovery is complete; nothing is built. Owner decisions of 2026-11-05 are recorded in 0016 and applied below; the rule schema still waits for the owner to confirm it.
Date recorded: 2026-11-05

## What the mockup contains today (PROVEN, prototype/src/public)
| # | Where | Program | Trigger | Wording (summary) | Placement |
|---|---|---|---|---|---|
| 1 | `measure/safety.js` + `RoadSafety.jsx`, "Why the limit is N here" | every speed program (fixed, mobile, average, and the speed part of red light); not mobile phone | none: always shown, folded; lines chosen by rules in code | Zone line by limit band (up to 50: people walk, cycle, cross; up to 70: crossings and driveways; up to 90: oncoming traffic separated only by a line; above: highway forces) | Under the speed scale, inside "How it was measured" |
| 2 | same | same | vehicle text matches motorcycle/rider/scooter | riders have no frame around them | same |
| 3 | same | same | vehicle text matches heavy/truck/prime mover | a loaded truck takes much further to stop | same |
| 4 | same | same | hour of day 20:00 to 04:59 | headlights only reach so far at night | same |
| 5 | same | same | speed above 50 (when none of 2 to 4 applied) | car protection falls away above about 50 side-on and 70 head-on | same |
| 6 | same | same | recorded speed above the limit | stopping distance at the reading vs at the limit, in metres and car lengths (1.5 s reaction, dry road, shown as a footnote) | same |
| 7 | same | same | none | "Towards Zero" goal sentence with a placeholder "[X]%" for the share of deaths where speed is a factor | foot of the note |
| 8 | `measure/content.js` + `GoodToKnow.jsx`, "How does this road safety camera work?" | one set of three cards per program (fixed, mobile, red light + speed, average, mobile phone) | none: chosen by program | Teaching cards, not warnings (for example "Amber is not red") | Folded block under the measurement picture |
| 9 | `Measure.jsx` red light caption | red light | the program | "The light had been red for N seconds when the vehicle crossed the stop line, travelling at S km/h" | Under the signal graphic |
| 10 | `Public.jsx` resources list | all | none | three links (NSW speeding facts, Towards Zero, a Victorian example) | Page foot |
Lines 1 to 7 are limited to three lines by the code. Every figure and wording is marked in the mockup as prototype copy to be confirmed by the road safety program owners. There is no bus lane content and no per-trigger wording beyond the list above. IDEA ONLY (not in the mockup): messages driven by speed over the limit by a margin, time since red, lane, day of week, or any returned field.

## Proposed structure (per-program configuration, same file as 0007, date-ranged and versioned with it)
    programs:
      - id: RED_LIGHT_SPEED
        versions:
          - version: 2026-a
            from: 2026-01-01
            messages:
              - id: rl-late-red
                priority: 20
                when: { all: [ { field: timeSinceRed, op: gte, value: 1.0 } ] }
                title: "A longer time after red"
                text: "The light had been red for {timeSinceRed} when the vehicle crossed the stop line."
                active_from: 2026-01-01      # optional
                active_to:                   # optional
              - id: rl-night
                priority: 5
                when: { all: [ { derived: hourOfDay, op: between, value: [20, 5] } ] }
                text: "Fewer people can see a red light at night: slow down early."
      - id: FIXED_SPEED
        versions:
          - version: 2026-a
            from: 2026-01-01
            messages:
              - id: sp-over-10
                priority: 30
                when: { all: [ { derived: speedOver, op: gte, value: 10 } ] }
                text: "At {recordedSpeed} in a {speedLimit} zone, stopping takes much further than at the limit."
              - id: sp-heavy-or-rider
                priority: 10
                when: { any: [ { field: vehicleType, op: in, value: [heavy, motorcycle] } ] }
                text: "..."
Condition language: a leaf is `{ field | derived, op, value }`; ops `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `between`, `in`; groups `all` and `any` nest. `field` names a key of the `details` map (0009) or a typed core field. `derived` names a computed value defined in code once: `speedOver` (recorded minus limit), `hourOfDay`, `dayOfWeek`, `secondsAfterRed`. Rules: a missing or unparsable field means the rule does not fire and nothing errors; text placeholders `{key}` that are missing drop the rule instead of printing a blank. Load-time checks (fail fast, same as 0007): unique ids, known ops, a priority on every rule, valid dates. Adding a rule or a field is a configuration edit. Adding a new derived value is one small code change.
Selection (DECIDED, record 0016): sort by priority (highest first) and show ONLY ONE message, the most relevant. Each program block has a `messages` on/off switch (inherited from the default block). Staff visibility of which rule fired is DEFERRED, so there is no "why am I seeing this" line in the first build. Messages are never in the PDF pack. Each message carries `approved_by` and `approved_on` (the owner approves the wording).

## Tester (plain table, fictitious values, runs without live data)
| Case | Program | Fields | Expected rule ids |
|---|---|---|---|
| A | FIXED_SPEED | recordedSpeed 72, speedLimit 60 | sp-over-10 |
| B | FIXED_SPEED | recordedSpeed 63, speedLimit 60 | none |
| C | FIXED_SPEED | speedLimit missing | none (no error) |
| D | RED_LIGHT_SPEED | timeSinceRed 1.4 seconds | rl-late-red |
| E | RED_LIGHT_SPEED | timeSinceRed 0.3 | none |
| F | RED_LIGHT_SPEED | timeSinceRed 2.0, time 22:15 | rl-late-red only (cap of one, highest priority) |
| G | any | rule outside active dates | none |

## Answers recorded 2026-11-05 (record 0016)
1. Cap: ONE message. 2. The owner approves wording, recorded beside each message in config. 3. Tone: plain, informative, never accusatory. 5. Which rule fired: staff visibility DEFERRED. 6. PDF pack: NO messages. Questions 4, 7 and 8 stay open.

## Questions for the owner (not guessed)
1. How many messages at once: only the top one, or a cap of 2 or 3 in priority order (recommended: cap 2)?
2. Who writes and approves the wording, and where is the approval recorded (recommended: the road safety program owners approve; the rule file carries `approved_by` and `approved_on`, and a decision record notes each change)?
3. Tone: informative, not accusatory, plain language, no scare figures, in keeping with the project's transparency aim. Confirm the rules for wording.
4. Translation later?
5. Should a message record which rule fired so it is explainable (recommended: yes; show it to staff and in the evidence pack)?
6. Does the PDF evidence pack include the messages (recommended: no, or only on request, because the pack is a copy of the evidence)?
7. Should the existing mockup note (lines 1 to 7 above) be rebuilt as rules in this file, or stay as fixed teaching content?
8. Which fields are real? Today only the camera code, offence text and location text come back for matching; the rest depend on 0009.

## Ruled out
Hard-coding messages in code per program; any rule that errors when a field is missing.
