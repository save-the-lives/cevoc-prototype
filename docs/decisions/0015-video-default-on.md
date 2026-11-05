# 0015. Video: on by default, never a download

Status: DECIDED (built, 2026-11-05)
Date recorded: 2026-11-05
Owner approval: given (owner decisions, locked, 2026-11-05, with clarification)

## Decision
Video is ON in the DEFAULT block (record 0014).
- Video on and a video is returned: the page plays it.
- Video on and none is returned: the page says so plainly under the transparency rule (not available yet). Never silent.
- Never a download. Never in the PDF evidence pack (record 0011).
- The video port and the player are kept.

## Clarification: the program wins
Video-on is the default block's behaviour only. If a program's own block sets video off, not applicable or not yet, the page does not try to fetch or render video and shows the plain message ("Video is not available for this program.", or the program's own wording). If the program block is silent, it inherits the default block's value (on).

## Consequence for the red light block
The earlier red light block set video to "not yet". It now says nothing, so it inherits on. The page still says plainly when no video is returned, which is what the legacy source does today.
