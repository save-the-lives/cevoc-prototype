# Project status: done vs not done

What is implemented, what is prototype quality, and what remains. This is the handover reference.

## Implemented and working

| Area | Status | Notes |
|---|---|---|
| Hexagonal architecture | **Production-ready** | ArchUnit enforces port/adapter boundaries at build time |
| Demo flow (fictitious notices) | **Working** | 15+ demo cases across speed camera and red light programs; hub page at `/demo-cases` |
| Privacy blur pipeline | **Working** | 4-layer: YuNet face + YOLOv8n plate detection + vehicle backstop + verification pass; fail-closed |
| Evidence gallery | **Working** | Swipe navigation, zoom, keyboard, accessibility labels, progressive image loading |
| Video playback | **Working** | Safari 206 byte-range support, HLS adaptive, inline on iOS, muted autoplay |
| Camera certificates | **Working** | Coverage assessment, PDF download, date-range validation |
| Program-specific display | **Working** | Red light visual (signal timeline), speed camera visual (speed scale), config-driven |
| Road safety messages | **Working** | Condition-based message engine from programs.json config |
| NSW Design System styling | **Working** | Public Sans, NSW DS colour tokens, buttons, steps, inputs — plain CSS, no framework dependency |
| IaC — Azure (Bicep) | **Working** | App Service, ACR, Key Vault, Front Door, monitoring; `infra/azure/` |
| IaC — AWS (CloudFormation) | **Working** | ECS Fargate, ECR, ALB, CloudFront, Secrets Manager, VPC; `infra/aws/` |
| Scheduled Playwright probe | **Working** | Hourly probe, post-deploy, all demo cases, Chromium + WebKit, GitHub issue open/close |
| Frame-by-frame leak check | **Working** | YOLO plate detection on blurred video output, frame grid artifact |
| Banner OCR verification | **Working** | Probe checks camera banner text readability per program type |
| Licence documentation | **Done** | `docs/research/blur-pipeline-licences.md` — YOLOv8n, YuNet, OpenCV, ffmpeg |

## Prototype / MVP quality (works but needs hardening)

| Area | What needs work |
|---|---|
| Error handling | Happy path is solid; edge cases (network timeouts, partial responses) need more coverage |
| Accessibility | Basic ARIA labels and keyboard navigation done; full WCAG 2.1 AA audit pending (`docs/UI-AUDIT.md`) |
| Mobile UX | Works on iPhone Safari and Android Chrome; some layout refinements needed |
| Blur accuracy | No labelled test set for measuring recall/precision; safety nets are in place but not quantified |
| Streaming blur | Designed but not yet implemented (whole-file processing only) |
| E2E test suite | 17 tests failing after shared media path migration; needs fixing |
| Performance | No CDN caching strategy; single container, no horizontal scaling yet |
| Monitoring | App Insights / CloudWatch configured but no custom dashboards or alerts |

## Not started (for production)

| Area | Notes |
|---|---|
| Real Revenue NSW / TfNSW API integration | Port exists (`PenaltyLookupPort`), adapter reserved (`api`). Awaiting API agreement |
| Authentication | Currently no-login public access. SSO / myServiceNSW integration not designed |
| Audit logging | No event log for who looked up what. Required for production compliance |
| Data residency | Azure Static Web Apps region not pinned; needs policy review |
| Rate limiting / abuse prevention | No throttling on the lookup endpoint |
| Production database | In-memory only today; shared persistent store (Cosmos DB / DynamoDB) not implemented |
| Multi-replica scaling | Blocked by in-memory media store; shared store needed first |
| Content Security Policy | Basic CSP headers but not hardened |
| Penetration testing | Not done |
| Load testing | Not done |
| Compliance review | Privacy Impact Assessment, security accreditation not started |

## Known technical debt

1. **In-memory media store** — evidence bytes held in one process; restart drops everything; can't scale beyond 1 replica
2. **Chromium browser route** — temporary scraper; needs site owner approval for real use; delete when API exists
3. **Sample/stub data in deployed image** — fictitious notices bundled in the JAR; clean up at cutover
4. **Python in backend container** — blur pipeline runs as subprocess; container split planned (vendor-neutral queue)
5. **No result cache on HTTP route** — every lookup hits the source; add cache with TTL for production
6. **Front-end bundle size** — hls.js (400KB gzip 124KB) loaded even when no video; lazy load only on video cases
