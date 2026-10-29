# AWS target runbook

Status: DRAFT, untested. Written before any AWS account is connected. Check each service's current availability, pricing and terms before relying on it.

Why this exists: the trial runs on Azure (see `DEPLOY-AZURE.md`), but the real implementation targets AWS. The app is built as ports and adapters so moving clouds means swapping adapters and the deploy workflow, not the domain.

## What changes and what does not
| Stays the same | Swapped for AWS |
|---|---|
| `domain/`, `application/` (no cloud SDK allowed, enforced by `ArchitectureTest`) | Media adapters: `adapter/out/s3` (new) replaces `adapter/out/azureblob` |
| Web adapter, React app, Dockerfile | Deploy workflow: `app-deploy-aws.yml` replaces `app-deploy-azure.yml` |
| Config-property adapter selection | Property values, e.g. `cevoc.media.adapter=s3` |

## Azure to AWS mapping
| Need | Azure (trial) | AWS (Sydney, `ap-southeast-2`) |
|---|---|---|
| Container registry | Container Registry | ECR |
| Backend hosting | Container Apps | ECS on Fargate behind an Application Load Balancer. App Runner is simpler, but check it still accepts new customers before choosing it |
| Frontend hosting | Static Web Apps | S3 bucket (private) behind CloudFront with origin access control. Amplify Hosting is a lower-effort alternative |
| `/api` routing | Static Web Apps linked backend | CloudFront behaviour `/api/*` forwarding to the ALB origin, so the browser stays same-origin and CORS is not needed |
| Evidence storage | Blob Storage | S3 (private bucket, block public access ON) |
| Short-lived signed links | SAS URL | CloudFront signed URLs (preferred, they pass through the CDN) or S3 pre-signed URLs |
| CDN | none for trial | CloudFront |
| Cache invalidation | n/a for trial | CloudFront `CreateInvalidation` |
| Pipeline identity | Entra app + federated credential | IAM OIDC identity provider for GitHub plus an IAM role scoped to this repo and branch |
| Secrets | GitHub secrets | GitHub secrets for role ARN only; app secrets (CloudFront signing key) in Secrets Manager |
| Logs | Log Analytics | CloudWatch Logs |

## Port to adapter map
- `MediaStoragePort` -> S3 `PutObject`/`HeadObject`. Backend writes metadata and objects but never streams media to browsers.
- `SignedLinkPort` -> CloudFront signed URL, a few minutes' expiry, read-only. The signing key pair lives in Secrets Manager; the public key is registered in a CloudFront key group.
- `CacheInvalidationPort` -> CloudFront invalidation for changed object paths. Evidence is immutable once issued, so prefer new object keys over invalidation.
Video: HLS renditions (480/720/1080) produced by an ffmpeg step at ingest and stored in S3; the player and signed links are unchanged. MediaConvert is an option later if ffmpeg becomes a burden.

## One-time setup (outline)
1. Account hygiene: separate AWS account (or organisation unit) for the app, billing alarm, MFA on the root user, no long-lived access keys.
2. Region `ap-southeast-2`. Confirm data residency needs; CloudFront is global but the origins stay in Sydney.
3. ECR repository `cevoc-backend`.
4. ECS cluster, Fargate task definition (0.5 vCPU / 1 GB to start, port 8080, health check path), service behind an ALB; HTTPS with an ACM certificate. Scale to a small minimum count; Fargate does not scale to zero, so budget for it.
5. S3 bucket for evidence (private) and S3 bucket for the front end (private); CloudFront distribution with origin access control for both and an `/api/*` behaviour to the ALB.
6. CloudFront key group and signing key for signed URLs.
7. IAM: OIDC provider `token.actions.githubusercontent.com`; a deploy role trusting only `repo:save-the-lives/cevoc-prototype` on the intended ref; permissions limited to ECR push, ECS update, S3 sync to the front-end bucket and CloudFront invalidation on that distribution.
8. App task role (separate from the deploy role): read/write on the evidence bucket, read of the signing key secret. Nothing else.

## Pipeline (outline for `app-deploy-aws.yml`)
Same shape as the Azure one: build and test, then `aws-actions/configure-aws-credentials` with the role ARN (OIDC, no stored keys), build and push the image to ECR, update the ECS service, build the React app, `aws s3 sync` to the front-end bucket, invalidate `/index.html`. Manual trigger first; deploy-on-merge later. Only `backend/` and `frontend/` paths; never `prototype/`.

## Cutover checklist (Azure trial to AWS)
- [ ] S3 and signed-link adapters implemented and covered by tests; `ArchitectureTest` still green
- [ ] Config switched with properties only, no domain changes
- [ ] Sample media copied to S3; links open from a phone and a laptop
- [ ] `/api` works through CloudFront; no CORS errors
- [ ] Logs visible, alarm on 5xx and on spend
- [ ] Azure resource group deleted to stop trial costs

## Open decisions
- ECS Fargate vs App Runner (availability for new accounts to be checked).
- CloudFront signed URLs vs S3 pre-signed URLs.
- Whether the real service sits inside Transport for NSW's own AWS landing zone, which would change networking, identity and approvals. This runbook assumes a standalone account for the MVP.
- Keep data fictitious and the prototype-only banner until real sources are connected.
