# 0035. A new Key Vault name after each teardown; no purge

Date: 2026-11-17. Status: accepted (owner, by voice).

A deleted Key Vault stays soft-deleted for 90 days and keeps its name. Purging it needs a subscription-wide right,
which the deploy identity must not have (owner: nothing in one resource group may be able to touch another). So the
teardown (`teardown-dev.yml`) only deletes what is in `rg-cevoc-dev`, and the vault's name carries a generation:
`cevoc` + environment + 4 characters + generation + `kv` (`kvGeneration` in `main.bicep`). The deploy keeps the
generation of the vault already in the group; when the group is empty it uses the run number. The pre-flight check for
soft-deleted vaults is removed. Soft-deleted vaults expire on their own after 90 days.
