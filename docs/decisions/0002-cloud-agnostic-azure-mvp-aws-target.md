# 0002. Cloud-agnostic; Azure is the MVP only, AWS is the real target

Status: Accepted
Date recorded: 2026-11-04
Owner approval: Stated by the owner in the project hand-off log; the original date of the statement is not recorded here. Seeded into this record on 2026-11-04.

## Chosen
The design must not be vendor specific. Azure (Container Apps, Static Web Apps, Blob) is the MVP trial. AWS is the real target (see `docs/RUNBOOK-AWS.md`). Vendor, provider and cloud specifics sit behind ports and adapters, or in deploy configuration.

## Why
The trial needed a fast, cheap host. The real implementation targets AWS, so nothing in the core may assume Azure.

## Ruled out
Building the core around Azure services; doing the AWS adapters now (not needed for the MVP).

Drift status is tracked in record 0008.
