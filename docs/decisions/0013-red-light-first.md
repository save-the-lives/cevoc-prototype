# 0013. Only red light is built now

Status: DECIDED
Date recorded: 2026-11-05
Owner approval: given (owner decisions, locked, 2026-11-05)

## Decision
Only the red light program is built now. Fixed speed, mobile speed, average speed, phone detection and bus lane follow later, one at a time, each as a new block in the per-program configuration (record 0007).

## Why
Smallest useful slice. Each later program needs its own evidence rules, wording and owner approval, and none of them is known yet.

## Consequences
- The configuration holds one real program block (red light) and the DEFAULT block (record 0014).
- Any notice that is not red light renders through the default block until its own program is added.
- Still open and NOT decided here: the camera look for bus lane and phone detection, evidence pack design confirmation, date-ranged configuration design confirmation, and the next step on certificates returning 403.
