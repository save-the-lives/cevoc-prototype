# 0033. The person's own plate rides with the video link, in memory only

Status: DECIDED (owner direction by voice, 2026-11-17); built.

## Context
The motorist must be able to check "was it my vehicle?", so the blurred video keeps their own plate visible and blurs
every other plate and every face (record 0017). The plate is always known: a lookup needs it. But the video is fetched
later, by a separate request on its own link, where the lookup's registration is gone. The old code read a thread-local
(`OffendingPlateContext`) that nothing ever set, so no plate reached the blur step; a hard-coded default (`ABC123`) hid
that for the demo (record 0032).

## Decision
- When the lookup makes a video's link, it hands the link the registration of that lookup (`RegistrationScope`).
- The in-memory media adapter keeps the plate with that one link token, in memory only, for the link's lifetime (it
  ends with the link: 20 minutes, extended while being read, never beyond 60). It is never stored to disk, logged, put
  in the link, or sent to the browser. `OffendingPlateContext` is deleted.
- The media endpoint asks for the plate of the token it is serving and passes it to the blur step, which keeps only that
  plate visible.
- Storage that cannot hold it (cloud links) ignores it, and then every plate is blurred: the privacy-safe outcome.
- The blur caches key on a digest of the plate, never on its text.

## Consequences
- Standing rule "never store the vehicle registration number": held, in the same way the registration is already held
  in memory during a lookup. This extends that in-memory life to the life of the video link.
- Image links do not carry it (images are not blurred).
