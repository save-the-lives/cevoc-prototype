# 0030. Cheapest lookup route first, adjusting itself when a route is refused

Status: DECIDED (owner direction by voice, 2026-11-17); built. Live result: see "Verified" below.

## Context
Every live lookup on 2026-11-17 was answered by the Chromium route (`source=SCRAPER_EVIDENCE` on all ten live cases),
the most expensive one: a browser per lookup, 2 CPU and 4 GiB, around 45 seconds a case. The plain HTTP route to the
Revenue NSW JSON service (record 0010, approved 2026-11-04) was built but never used, because it needed four settings,
one of them a path segment nobody had configured.

## Decision
- With no lookup settings at all, the order is `http,browser`: cheapest first (`EvidenceProviders`).
  `CEVOC_PENALTY_LOOKUP_ADAPTER` or `CEVOC_EVIDENCE_PROVIDERS` still pick one route or another order explicitly.
- The HTTP route needs no settings: the base address defaults to the approved host, the contact and approval
  reference are optional, and the path segment is learned from the page's own calls the first time the Chromium route
  runs (`LearnedServicePath`, path segment only). A configured `CEVOC_REVENUE_NSW_HTTP_PATH_PREFIX` always wins.
- `AdaptivePenaltyLookupAdapter` decides per lookup:
  - refused by the source (401, 403, 429, captcha, or an answer we cannot read): skip HTTP for 24 hours, then try again;
  - not ready (no path yet): pass over it at no cost, never remembered;
  - passing fault (timeout, network, server error): 3 in 5 minutes skips HTTP for 10 minutes;
  - FOUND, NOT_FOUND and INPUT_REQUIRED are final: the next route is never asked the same question.
- Memory is in the process only; a restart starts from the cheapest route again.
- Certificates were already cheapest first (`curl,http,browser`, record 0025); unchanged, no memory added there.

## Consequences
- The HTTP route had never run live. Whether the source accepts it is decided by the first live lookups, not assumed;
  if it refuses, lookups fall back to Chromium and the refusal is remembered for a day.
- Docs that describe the HTTP route as needing four settings (`docs/CONFIG-REFERENCE.md`, record 0010 "How to select")
  are out of date on that point; this record wins.

## Verified
(Filled in from the release gate run after deploy.)
