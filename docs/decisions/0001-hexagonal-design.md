# 0001. Hexagonal design (ports and adapters)

Status: Accepted
Date recorded: 2026-11-04
Owner approval: Stated by the owner in the project hand-off log; the original date of the statement is not recorded here. Seeded into this record on 2026-11-04.

## Chosen
Dependencies point inwards: adapter -> application -> domain. Ports are interfaces in `application/port`; each source or store is an adapter. `BeanConfig` is the only place that picks an adapter. `ArchitectureTest` enforces it.

## Why
Sources (Revenue NSW, TfNSW, storage, clouds) will change. Keeping them behind ports means a swap is configuration plus an adapter, not a rewrite.

## Ruled out
Calling provider or cloud SDKs directly from application or UI code.
