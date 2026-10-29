# Shared UX patterns (one platform, two agency experiences)

Agency differences are limited to: accent colour, landing emphasis, default filters, contextual information and permitted actions. Everything else is shared.

## Shell
- Header: agency logo, product title naming the agency in text (“Revenue NSW | Review support”, “Transport for NSW | Technical assurance”), global search button (Ctrl+K), notifications, user menu.
- Top navigation, identical in structure: Search, Dashboard, the agency's work lists, reference lists, Trends. Phones keep a static scrolling strip.
- Accent: Revenue blue `#146cfd`, Transport purple `#5b3fa0` (CSS variables `--ac`, `--ac-soft`, `--ac-ink`). Colour is never the only signal.

## Landing
Greeting, one search box (focused on arrival), quick links, at most four indicators (each a link to a filtered list), a short work list, one call to action. Managers see the operational dashboard instead; officers can still open it.

## Search
One behaviour for both agencies. Revenue order: penalty notices, reviews, cameras, certificates, referrals. Transport order: cameras, certificates, referrals, penalty notices. Live results, recent searches, restored on Back (address plus tab storage, no reload). Certificate check by location code and date range. Meaningful empty state.

## Record workspace
Identity and status at the top, evidence visible while assessing, supporting history and technical records alongside, only the actions the role may take.
- **Four status concepts, always separate:** certification validity, evidence completeness, assessment status, enforcement defensibility. Defensibility is “Not assessed” until a Transport determination, and is never green.
- Source evidence is read-only and labelled.
- Revenue: Resolution (answered, or checked with no technical concern), Refer to Transport, or Notify Transport (court election).
- Transport: Acknowledge, Start assessment, Assessment and recommendation, Determination (authorised roles), Request clarification, Escalate internally, Link related issue.

## Referral lifecycle (Proposed)
Revenue referral, Transport acknowledgement, Technical assessment, Determination issued, Revenue downstream action. Each referral shows owner, status, time in state, last activity, next required action, internal target, escalation. Acknowledged is never shown as assessed, and a recommendation is never shown as a determination.

## Status colours
Neutral grey: not yet assessed or informational. Blue: active or in progress. Amber: attention required. Red: critical or genuinely urgent. Green: completed or positively verified (certification validity only).

## Permissions
| Role | Agency | Permissions |
|---|---|---|
| Review officer, prosecutions officer | Revenue | decide (resolve), refer |
| Review manager | Revenue | decide, refer, assign work to others, team workload |
| Operations manager | Revenue | assign work to others, team workload |
| Customer inquiry officer, adjudication officer | Transport | assess, recommend |
| Technical systems advisor | Transport | assess, recommend, request certificate withdrawal |
| Camera program manager, technical assurance manager | Transport | assess, determine, approve certificate withdrawal, assign work |

## Accessibility
Keyboard operation throughout (queue keys, quick finder), visible focus, labels and errors in words, no horizontal scroll at desktop or phone widths, WCAG 2.2 AA checks in `npm run test:e2e`.
