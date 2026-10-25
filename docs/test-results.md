# End-to-end test results

Run: 2026-10-25T19:13:38.353Z  
Result: **85 passed, 0 failed** of 85 checks.

All data is fictitious and all integrations are simulated. These tests run against a local preview build.

## A. Start-of-day orientation

| Check | Result |
|---|---|
| Revenue NSW: agency named in the header | PASS |
| Revenue NSW: search is the first thing (officer landing) | PASS |
| Revenue NSW: at most four indicators | PASS |
| Revenue NSW: every indicator links to a filtered view | PASS |
| Revenue NSW: no horizontal scroll at 1360 | PASS |
| Revenue NSW: no page errors | PASS |
| Transport for NSW: agency named in the header | PASS |
| Transport for NSW: search is the first thing (officer landing) | PASS |
| Transport for NSW: at most four indicators | PASS |
| Transport for NSW: every indicator links to a filtered view | PASS |
| Transport for NSW: no horizontal scroll at 1360 | PASS |
| Transport for NSW: no page errors | PASS |
| Revenue NSW manager lands on the dashboard | PASS |
| Revenue NSW manager: dashboard marked Proposed | PASS |
| Transport for NSW manager lands on the dashboard | PASS |
| Transport for NSW manager: dashboard marked Proposed | PASS |

## B. Certificate retrieval

| Check | Result |
|---|---|
| Search by penalty notice number finds the notice | PASS |
| Result shows certification validity | PASS |
| Selecting a result opens the notice record | PASS |
| Returning preserves the search | PASS |
| No match shows a meaningful message | PASS |
| Search by camera location code finds the camera and certificates | PASS |
| Certificate check validates empty fields | PASS |
| Location and date-range check returns spans and certificates | PASS |

## C. Revenue review journey

| Check | Result |
|---|---|
| Four separate status concepts are shown | PASS |
| Defensibility is “Not assessed” before a determination | PASS |
| Reason for the review is visible | PASS |
| Refer to Transport is discoverable | PASS |
| Revenue is not offered a withdrawal outcome | PASS |
| Referral keeps the matter on Revenue’s list | PASS |
| Revenue cannot resolve while referred | PASS |

## D. Court-elected matter

| Check | Result |
|---|---|
| Court pathway is identifiable | PASS |
| No Revenue outcome form for a court election | PASS |
| Court steps are not presented as CEVOC-owned | PASS |
| Notification dialog is pre-filled | PASS |
| Transport sees the court notification as a referral | PASS |

## E. Transport assessment

| Check | Result |
|---|---|
| Reason for challenge is visible to Transport | PASS |
| Source evidence is marked read-only | PASS |
| Certification records are available without leaving the page | PASS |
| Defensibility is not assessed before a determination | PASS |
| A customer inquiry officer has no determination control | PASS |
| A recommendation is not a determination | PASS |
| Revenue sees “awaiting determination”, not an outcome | PASS |

## F. Withdrawal authority

| Check | Result |
|---|---|
| Adjudication officer cannot issue a determination | PASS |
| An authorised role can | PASS |
| Determination needs a rationale | PASS |
| Still disabled without a rationale | PASS |
| Confirmation required before finalising | PASS |
| Determination is recorded and shown as Transport’s | PASS |
| Original evidence is unchanged (still read-only) | PASS |
| Revenue is informed, not asked to decide | PASS |
| Revenue records downstream steps and the matter closes | PASS |
| No page errors in the shared flow | PASS |

## G. Agency permissions

| Check | Result |
|---|---|
| Transport cannot open the Revenue review queue by deep link | PASS |
| Revenue sees a referral read-only (no determination or assessment controls) | PASS |
| Customer name is not in Transport’s search page, even hidden | PASS |
| Customer name is withheld on the matter page for Transport | PASS |
| A non-approver sees certificate requests, not approval actions | PASS |

## H. Accessibility and usability

| Check | Result |
|---|---|
| Revenue landing: no axe violations (WCAG 2.2 AA tags) | PASS |
| Revenue landing: no horizontal scroll at 1360 | PASS |
| Transport landing: no axe violations (WCAG 2.2 AA tags) | PASS |
| Transport landing: no horizontal scroll at 1360 | PASS |
| Revenue dashboard: no axe violations (WCAG 2.2 AA tags) | PASS |
| Revenue dashboard: no horizontal scroll at 1360 | PASS |
| Revenue record: no axe violations (WCAG 2.2 AA tags) | PASS |
| Revenue record: no horizontal scroll at 1360 | PASS |
| Transport record: no axe violations (WCAG 2.2 AA tags) | PASS |
| Transport record: no horizontal scroll at 1360 | PASS |
| Revenue landing: no horizontal scroll on a phone | PASS |
| Transport landing: no horizontal scroll on a phone | PASS |
| Keyboard only: typing reaches search results | PASS |
| Visible focus on the search box | PASS |

## I. Regression

| Check | Result |
|---|---|
| Public lookup validates empty input | PASS |
| Public lookup opens the notice | PASS |
| Public certification list is shown | PASS |
| Public camera pages still load | PASS |
| Public pages have no errors | PASS |
| kai can open /staff/cert/S137-PAR001-2026 without a crash | PASS |
| morgan can open /staff/queue/approvals without a crash | PASS |
| alex can open /staff/certificates without a crash | PASS |
| jo can open /staff/cameras without a crash | PASS |
| sam can open /staff/insights without a crash | PASS |
| sam can open /staff/overview without a crash | PASS |
| alex can open /staff/queue/court without a crash | PASS |
| Scenario 1: a routine enquiry is resolved without Transport | PASS |

## Scenario baselines (interactions)

Counts of scripted clicks, typed fields and key presses. This is a baseline for this prototype only, not a measured improvement and not a user-research result.

| Scenario | Interactions | Note |
|---|---|---|
| 2 + 4 + 5. Revenue refers, Transport assesses and determines, Revenue acts downstream | 15 | two people, one matter, nine clicks or fields on the Transport side |
| 1. Revenue routine enquiry: search, open, resolve | 5 | search, open review, choose resolution, write note, submit; Transport not involved |
