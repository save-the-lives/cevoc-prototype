# 0019. Camera banner read from the image pixels by server-side OCR

Status: LOCKED (owner decision, 2026-11-05; first PROPOSED, then approved the same day). Built behind a switch that is off by default.

## Context
The live source prints the camera banner (camera code, direction, operator, location, incident number, lane, offence, speed limit,
time since red, yellow light duration, date, time) as bold white text on a black strip at the top of the first, full-size evidence
image. Four rounds of structure-only probes found it nowhere else (not in the page text, frames, responses or metadata): it is in the
picture's pixels. The mock-up shows two of the facts: time since red (seconds) and speed limit (km/h).

## Decision
1. OCR is approved for these banner details, on the server, and only for the first image.
2. Port `BannerTextReaderPort` (application layer, vendor-neutral). One adapter, `adapter/out/ocr/TesseractBannerTextReader`, calls the
   open-source Tesseract engine (Apache-2.0) as the `tesseract` command line program installed in the container image. The picture is
   handed over on standard input and the text read from standard output: nothing is written to disk. No library dependency was added
   (so no Java wrapper to keep in step with native libraries) and no cloud service is used; on AWS the same image works unchanged.
   Another engine means another adapter behind the same port.
3. Image handling is in memory: only the top part of the picture is decoded; the black band is found by scanning rows (mostly dark
   pixels, few mid-tones), with a fallback of 15 percent of the height; the band is scaled so a text line is about 48 px, binarised and
   inverted (dark text on white); character whitelist of letters, digits and `:.,/-`; single-block page segmentation (`--psm 6`).
4. The text goes through the existing tolerant `CameraBannerParser` (new `parseOcr`): label spellings are matched loosely (i/l/1, m/rn,
   o/0, lost colons, spaces run together) and numbers are read tolerating O for 0, l or I for 1, stray spaces and punctuation, and a comma
   for the decimal point. Only `timeSinceRed` and `speedLimit` are carried (record 0009). A missing or unreadable field is simply absent;
   one never breaks the other. Text found in the page itself, if any, wins over OCR.
5. Privacy of the process: raw OCR text and values are never logged or stored. Diagnostics are counts only (image size, strip height,
   number of text lines, number of labels read, whether each of the two fields was read). When OCR ran and gave no usable field the step
   trace carries the whitelisted cause `banner-unreadable` on the capture-images step (outcome stays ok); the lookup never fails.
6. No separate switch: banner OCR is always available; the scraping adapter uses it when active. The former `cevoc.banner-ocr.enabled`
   env var is removed. Optional `cevoc.banner-ocr.command` and `cevoc.banner-ocr.timeout-seconds`. Demo data never runs OCR (it has
   its own adapter and its banner text is data, record 0018).
7. `ArchitectureTest`: only the OCR adapter package and the wiring may know the OCR adapter; the adapter uses only ports and domain;
   OCR wrapper libraries may not appear elsewhere; domain and application never start processes.

## Consequences
- The image gains the `tesseract-ocr` package (English data only, no recommended extras).
- One short external process per lookup that has images (well under a second for a full-size banner on a development machine), with a
  30 second limit. A missing or failing program gives no details, not an error.
- Tests draw fictitious banners (made-up values) in the test itself. Engine tests skip where the program is absent but fail in CI, which
  installs `tesseract-ocr`.
