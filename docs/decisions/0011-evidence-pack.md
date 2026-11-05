# 0011. Evidence download and one-file evidence pack

Status: DESIGN for the owner's review; the owner's rules (below) are decided, the build choices are recommended. Nothing built.
Date recorded: 2026-11-05
Owner approval: the owner's rules were given by voice on 2026-11-05; the recommendations await a go.

## Owner's rules (decided)
1. A plain, obvious download of the evidence images, at full resolution where the source provides it.
2. Video is never downloadable. The page says video is available online only, or is not yet available, under the transparency rule (0007).
3. One PDF "evidence pack": the images, the covering certificate and its details when present, and the offence metadata (program, camera code, location text, date and time, red light timing where it applies, from the `details` map in 0009). If there is no certificate the PDF says so in plain words, using the same status messages as the page (off by choice, not applicable, not yet available, failed).
4. Privacy: generated on request, in memory; never stored, cached, logged or committed, nor any of its content; offered only after the same step that releases the images (the registration check); no real values in fixtures, tests, screenshots or docs; the filename holds no notice number or plate; a source and retrieved-at note inside the pack says which part came from Revenue NSW and which from TfNSW (interim sources, to be replaced by TfNSW APIs) and that it is a copy for information.

## What the mockup already has (PROVEN, prototype/src)
- `shared/MediaGallery.jsx`: a download button on each item and "Download all (n)" with preparing, done and error states, and a note when some files are unavailable and left out of "Download all".
- `public/CertificateView.jsx` and `lib/certDoc.js`: "Download PDF" for a certificate.
- No evidence-pack screen and no single PDF exist in the mockup.
- Conflict to resolve: the mockup lets a motorist download VIDEO items (`MediaGallery` treats every item alike). The owner's rule 2 overrides: the working page does not offer a video download. The mockup is left unchanged.

## Recommended design
- Where it is built: the backend, on request, behind a port `EvidencePackPort` (domain input: the already released evidence items, certificate rows, offence facts, status messages, source notes; output: a byte stream). The PDF library is an adapter detail. Recommendation: Apache PDFBox (Apache 2.0) or OpenPDF; avoid AGPL libraries. Accessibility needs it must meet: tagged PDF with a document title and language, a real reading order, headings, alt text on every image, selectable text, sufficient contrast. Whether the chosen library can produce a fully tagged PDF is UNCONFIRMED and must be checked before the choice is final.
- What goes in: cover page (title "Evidence copy", program, date and time, location text, the red light facts when present, each with a label from the program configuration); one image per page at full size with alt text; the certificate section; a "Sources and retrieved" section; a plain footer "A copy for information".
- Certificate content: the source gives certificate rows (description, type, period, certified date, expiry, covers-the-offence flag). The signed deep link to the certificate document answers 403 and is off, so the pack carries the rows as a table, not the source's certificate document. The PDF says so ("This is a summary of the certificate details; the original document is not available here"). If the status is not available, the PDF section states that reason with the page's own wording.
- Entitlement and plate: the plate is request-scoped and not kept. So the pack must not need it again. The pack request carries only the opaque media references the page already received (signed, expiring); the backend verifies them and reads the bytes from the media store inside the existing retention window, never fetching from the source again. INFERRED from the current ports (`MediaReadPort`, `SignedLinkPort`); check against the code before building. If the images have expired the page offers "run the check again".
- Size and load: about 1.4 MB per full image, so a pack of 3 to 6 images is roughly 4 to 9 MB. Stream the PDF to the response, never write a temp file, cap images per pack, and allow at most 2 packs at once (the container runs small) with a clear "try again shortly" message beyond that. The page shows "Preparing your pack" with a spinner, the expected size, and a polite live-region message when done or failed; a failure uses the technical-failure wording, not the by-design wording.
- Filename: a fixed pattern with the date only, for example `evidence-copy-<yyyymmdd>.pdf`. No notice number, plate, location or camera code.
- Configuration: the pack is another switchable item in the per-program configuration (`types.evidence_pack: { mode, message }`) with its own not-available message, date-ranged like the rest.
- Image download: plain "Download image" per image and "Download all images" using the full-size variant when the source has one; a short sentence beside it states the resolution if known. No video button; the video area shows the status message.
- Mobile and accessibility checks to run when built: tap targets, keyboard use, screen-reader announcements for progress and errors, the PDF opened in a screen reader, and a narrow-width layout.

## Dependencies and order
Needs a certificate source (today's `search-page` route, not yet proven to return a row on the live site) and the red light page (0009). The design report can proceed now; the build follows the certificates live test and the red light page.

## Secondary ideas (proposals only, not built)
What happens next (the four options already on the page, with dates when known); a notice timeline (offence, notice, due date); a one-line why-it-matters note beside each kind of evidence; a help and contact block (the page already carries a help phone number); a print stylesheet; mobile and accessibility audit. Each is a display mapping, none needs new data.

## Ruled out
Storing or caching packs; putting the notice number or plate in the filename; a video download; generating the PDF in the browser from data held there (it would put certificate and offence data into client code paths we cannot test centrally).
