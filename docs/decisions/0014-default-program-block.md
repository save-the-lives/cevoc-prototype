# 0014. Default program block and switch inheritance

Status: DECIDED (built in the front end configuration, 2026-11-05)
Date recorded: 2026-11-05
Owner approval: given (owner decisions, locked, 2026-11-05, with clarification)

## Decision
Any notice whose program is not configured, or cannot be matched, uses a DEFAULT block in the same plain YAML/JSON, date-ranged configuration file as the programs (record 0007). The default block shows:
- core evidence (images and certificates, each per its switch),
- the common notice details,
- one plain, visible message that program-specific details are not available for this notice yet.
Nothing is hidden silently and the page never errors for an unknown program. This replaces question 7 of record 0007 ("recommended: the default block" is now the decision).

## Inheritance (clarification)
A program's own block always wins. A switch the program block does not set is inherited from the default block. This applies to every switch: images, certificates, video, evidence pack, road safety messages. A known program with no version covering the offence date also falls back to the default block's switches.

## Rules
- The default block must exist in the configuration, is loaded, passes the same version checks, and is tested: a fictitious notice with an unknown program renders the default.
- The red light page behaves the same when its own block is missing.

## Ruled out
Showing every type "as before" for an unmatched notice; hiding unmatched notices' details without a message.
