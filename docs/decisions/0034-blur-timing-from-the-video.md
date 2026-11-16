# 0034. Blur timing comes from the video; the notice's own plate is never blurred

Date: 2026-11-17. Status: accepted.

## What went wrong
The owner saw the notice's own plate readable in one frame of the demo video and blurred in the next. Three steps each
guessed instead of reading the video:
- `merge_tracks.py` assumed 12 frames a second and truncated `t * fps`, so a detection at t=0.0833 landed on frame 0,
  not 1. Every third frame lost its own-plate entry.
- `render_blur.py` defaulted to 25 frames a second when the merged file had no rate.
- The "hold last position" filler only filled frames with no detection of any kind, so a frame with a face in it kept
  no own-plate position. Verification then found the own plate there, counted it as a leak and blurred it.

## Decision
1. Frame numbers are made once, in the renderer, from each detection's timestamp and the video's own frame rate,
   rounded. No step has a default frame rate; a video whose rate cannot be read is refused.
2. Positions are held per track, so a missed detection of one track is filled whatever else is in the frame.
3. Every blur pass, including verification re-blurs, puts the own plate's pixels back after blurring, so a car-sized
   backstop box or a widened leak box cannot cover it.
4. `check_own_plate.py` runs the whole pipeline and checks the own plate is sharp in every frame where it was seen;
   it runs on both demo videos in `app-ci.yml`. The plate is passed as input (it is painted into the demo video), not
   written into the pipeline.
