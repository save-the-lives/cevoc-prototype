# CEVOC Modernisation: what changed, what is still open

All people, penalty notices, certificates and images are fictitious. Sign-in, notifications, the Revenue NSW case system, and every hand-off are simulated. Nothing is connected to a real agency system.

Screenshots: `docs/screenshots/` (`before-*` and `after-*`, for both agencies' landing pages and active record workspaces). Test results: `docs/test-results.md` (run with `npm run test:e2e`). Shared patterns: `docs/UX-SPEC.md`.

## 1. Contradictions found, and how each was handled

The final brief conflicts with earlier direction and with parts of the prototype. I followed the latest instruction where it was explicit, kept earlier decisions where the brief was silent, and recorded each item so it is not silently promoted to a requirement.

| Earlier prototype or direction | Final brief | What I did |
|---|---|---|
| Revenue made the final decision on referred matters; Transport only advised and could not withdraw. | Withdrawal authority sits with Transport. Revenue is informed and acts downstream. | Rebuilt the flow: Revenue refers; Transport assesses and recommends; only an authorised Transport role (camera program manager, technical assurance manager) determines; Revenue records its downstream steps. Revenue no longer has a withdrawal outcome. |
| Transport blue, Revenue red. | Revenue blue, Transport purple, agency also named in text. | Followed the brief. |
| Dashboard-first landings. | Do not build dashboards by default; one clear primary action; 3 to 4 indicators. | Combined with the product owner's later direction: officers land on search with four indicators; managers land on the dashboard (marked Proposed). |
| Targets, “at risk”, overdue and escalation shown as operational facts. | Do not fabricate SLA rules or breaches. | Relabelled as an illustrative internal target (“Nearing / Past internal target”), configurable in the demo hub, never statutory, and marked Proposed. |
| One “Validation: Clear / Review required” flag. | Certification validity, evidence completeness, assessment status and enforcement defensibility are separate; never green for defensible. | Four separate indicators on every record. Defensibility reads “Not assessed” until a Transport determination exists and is never green. |
| Transport could open the Revenue case and see the customer's name and grounds. | Show only what is needed. | Transport sees the reason for the review and the evidence, not the customer's name. A privacy decision is still needed (register V14, P4). |
| Revenue “Prepare brief of evidence” for court elections. | Prosecution and court workflows are external. | Court-elected matters have no Revenue outcome. Revenue notifies Transport; the court process is stated as outside CEVOC. |
| Letter preview for customer decisions. | Customer correspondence is not an approved capability. | Removed the letter preview. Revenue records a note instead. |

## 2. Implemented in the prototype

- **Role-aware landing.** Officers, advisors and adjudicators land on search (greeting, one search box, quick links, four indicators, a short work list, one call to action). Managers land on the operational dashboard. The side menu became a top navigation, the same for both agencies.
- **Search.** Revenue starts from the penalty notice; Transport starts from the camera and its certificates. Results are grouped, recent searches are kept, the search is restored on Back. Customer names are never searched or shown for Transport.
- **Certificate check by location code and date range** (the brief lists this as existing in CEVOC, so this is an illustration to compare against the real behaviour).
- **Referral to Transport** (with category, question, evidence summary, related earlier determinations) and, for court elections, **notification** to Transport.
- **Transport workbench:** acknowledge, start assessment, record an assessment and recommendation, and (authorised roles only) issue a determination: enforcement remains supportable, withdrawal authorised, or further information required. A rationale and a confirmation are required. Source evidence is read-only and labelled so.
- **Revenue downstream step:** Revenue records that its own downstream steps are complete, which closes the matter.
- **Business validation register** and **Capability status** pages in the demo hub, reconciled with the earlier open questions.
- **Five evaluation scenarios** in the demo hub, plus the certificate-withdrawal scenario.

## 3. Conceptual only (marked “Proposed” in the interface)

Manager dashboard and team workload; response targets and escalation; the live event feed and notifications; the acknowledged, assessed, determined lifecycle; role-based landing; minimised customer data for Transport; the four-concept status model; Transport issuing determinations inside CEVOC (see V8).

## 4. Assumptions and outstanding decisions

See the validation register (demo hub, “Validation register”) for V1 to V16 and P1 to P4, each with owner, status and impact. The most consequential:

1. **V8 / V12: where a withdrawal determination is recorded, and which roles hold the authority.** I assumed the camera program manager and technical assurance manager. If it is recorded elsewhere, the determination screen becomes context plus a hand-off.
2. **V2: what Revenue can resolve alone.** Assumed to exclude withdrawal on technical grounds.
3. **V4: referral criteria.** None exist in the prototype; any matter can be referred.
4. **V10: existing external systems.** Unknown. Queues, targets and the lifecycle may duplicate them.
5. **Terminology.** “Withdrawal” is used for two things: withdrawing a certificate (existing flow, two-person approval) and withdrawing enforcement (the new determination). The interface says which; the business should confirm the vocabulary.

## 4a. Additional APIs, data fields, permissions and dependencies (if any of this were built)

- Certificate register queryable by location code and effective date, including withdrawal history.
- A referral record: id, source matter id, category, question, status, timestamps per step, assignee, assessment, determination (outcome, rationale, decider, time), and a downstream-complete marker.
- Event or notification channel between agencies.
- Role and group claims from each agency's identity provider (officer, manager, authorised determiner).
- Permission `withdraw:determine`, separate from `inspect:request` and from certificate withdrawal approval.
- A deep-link contract and return address for each source system.
- Audit fields: who, when, what, evidence referenced.

## 5. Known gaps and defects

- Scatter-plot dots on the Trends page can overlap and miss the 24px target-size guideline. Every case is also reachable from the queue.
- The “before” baseline for interactions was not measured: the scenario counts in `docs/test-results.md` are scripted counts for the new design only, not an improvement claim.
- Screen-reader testing and 200% zoom still need a manual pass.
- Pagination and virtualised lists are not built (ten sample matters).
- The queue keeps the earlier column and query model; it has not been re-examined against the brief's “high-density tables” beyond the new default columns.
- Agency logos are the official files supplied; branding rules should still be confirmed.
