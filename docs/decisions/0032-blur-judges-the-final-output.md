# 0032. Blur verification judges the final video; no built-in offending plate; "still blurring" is not a failure

Status: DECIDED (owner direction 2026-11-17: fix the demo video blur properly, no hard-coding); built.

## What was wrong (reproduced on both sample videos, 2026-11-17)
Every demo video was refused (HTTP 451) and the page showed "Preparing video for safe viewing" for ever.
1. **Verification counted its own blur as a leak.** The plate detector still finds a plate-shaped box where a plate has
   been blurred, so each verification round "found" the plates it had just blurred and the video never passed.
2. **The loop refused on leaks it had already fixed.** After the last re-blur it failed closed without checking the result.
3. **A plate was hard-coded.** `detect_plates.py --offending` and `render_blur.py` defaulted to `ABC123`, which kept any
   plate reading `ABC123` visible. It happened to match the demo video. Nothing in the app ever passes a plate to the blur
   step (`OffendingPlateContext` is read but never set), so the default was the only reason the demo plate showed.
4. **"Still blurring" and "failed" were the same answer** (451), and a failed blur was re-run on every poll.

## Decision
- A detection that lies at least half inside the union of regions already blurred on that frame is the blurred region,
  not a leak. Leaks are re-blurred with a 50% wider box (privacy-safe direction).
- Up to six re-blur rounds; the decision is made by verifying the final output. On the sample videos it converges in
  two (video-2) and five (video-1) rounds.
- No default offending plate: without a nominated plate every plate is blurred, the motorist's own included.
- The blur port has a third answer, pending. The media endpoint answers 503 with `Retry-After: 5` while blurring,
  451 only when it failed. A failed blur is remembered for 2 minutes. The page asks again on 503 (up to five minutes)
  and stops with a plain message on 451.

## Consequences
- The offending plate is blurred in videos too until a plate is passed to the blur step. Doing that without storing
  the registration (standing rule) is an open design question for the owner.
- Over-blur: interpolation holds a region for a few frames after a vehicle moves, so a grey block can trail a moving
  car briefly. Privacy-safe; cosmetic.
