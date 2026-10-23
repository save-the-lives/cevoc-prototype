// Mock service layer. Stands in for the target API so screens don't talk to data directly.
// ctx = { outage, overrides, latency (ms), timeout, timeoutAfter, certOutage, imageOutage }
// Services are separated (core / cert / evidence) so partial failures stay partial.
import { NOTICES, SITES, CERTIFICATES, REVIEW_CASES, ADDITIONAL_EVIDENCE } from '../data/mockData.js';

export class UpstreamError extends Error {
  constructor(message = 'Source system unavailable', kind = 'outage') {
    super(message);
    this.name = 'UpstreamError';
    this.kind = kind; // outage | timeout | cert | evidence
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const withStatus = (item, overrides) => ({ ...item, status: overrides[item.id] ?? item.status });

async function call(ctx, fn, service = 'core') {
  if (ctx.timeout) {
    await wait(ctx.timeoutAfter ?? 6000);
    throw new UpstreamError('Request timed out', 'timeout');
  }
  await wait(ctx.latency ?? 300);
  if (ctx.outage) throw new UpstreamError();
  if (service === 'cert' && ctx.certOutage) throw new UpstreamError('Certificate service unavailable', 'cert');
  return fn();
}

const sortCerts = (list) => list.sort((a, b) => b.validFrom.localeCompare(a.validFrom));

export const api = {
  lookupNotice: (ctx, number, rego) =>
    call(ctx, () => {
      const n = NOTICES.find((x) => x.number === number && x.rego === rego.toUpperCase().replace(/\s/g, ''));
      if (!n) return null;
      if (n.upstreamFailure) throw new UpstreamError();
      const imagesDown = n.imagesUnavailable || ctx.imageOutage;
      return {
        ...n,
        imagesUnavailable: !!imagesDown,
        images: imagesDown ? [] : n.images.map((i) => withStatus(i, ctx.overrides)),
        media: n.media.map((m) => withStatus(m, ctx.overrides)),
      };
    }),

  searchSites: (ctx, q, type) =>
    call(ctx, () => {
      const t = q.trim().toLowerCase();
      return SITES.filter(
        (s) =>
          (!type || s.type === type) &&
          (!t || [s.code, s.name, s.suburb, s.lga, s.type].join(' ').toLowerCase().includes(t))
      );
    }),

  getSite: (ctx, code) => call(ctx, () => SITES.find((s) => s.code === code) || null),

  certificatesForSite: (ctx, code) =>
    call(ctx, () => sortCerts(CERTIFICATES.filter((c) => c.site === code).map((c) => withStatus(c, ctx.overrides))), 'cert'),

  getCertificate: (ctx, id) =>
    call(
      ctx,
      () => {
        const c = CERTIFICATES.find((x) => x.id === id);
        return c ? withStatus(c, ctx.overrides) : null;
      },
      'cert'
    ),

  officerSearch: (ctx, { site, from, to }) =>
    call(
      ctx,
      () =>
        CERTIFICATES.filter(
          (c) => (!site || c.site === site) && (!from || c.validTo >= from) && (!to || c.validFrom <= to)
        )
          .map((c) => withStatus(c, ctx.overrides))
          .sort((a, b) => a.site.localeCompare(b.site) || b.validFrom.localeCompare(a.validFrom)),
      'cert'
    ),

  // Revenue NSW review workspace: case + full notice (officer view) + site + certificates
  reviewCase: (ctx, id) =>
    call(ctx, () => {
      const kase = REVIEW_CASES.find((c) => c.id === id);
      if (!kase) return null;
      const notice = NOTICES.find((n) => n.number === kase.notice);
      return {
        kase,
        notice,
        site: SITES.find((s) => s.code === notice.site),
        certs: sortCerts(CERTIFICATES.filter((c) => c.site === notice.site).map((c) => withStatus(c, ctx.overrides))),
      };
    }),

  // Evidence held by Transport beyond the notice. Slower by design (separate system).
  additionalEvidence: (ctx, noticeNumber) =>
    call({ ...ctx, latency: (ctx.latency ?? 300) + 900 }, () => ADDITIONAL_EVIDENCE[noticeNumber] || [], 'evidence'),
};

// Business rules shared by screens
export const applicableOn = (certs, date) =>
  certs.find((c) => c.status === 'published' && c.validFrom <= date && c.validTo >= date) || null;

export const publicCertificates = (certs) => certs.filter((c) => c.status !== 'restricted');

export const can = (officer, permission) => !!officer && officer.permissions.includes(permission);

// Synchronous certificate check used by the adjudication queue.
export const certificateInForce = (site, date) =>
  applicableOn(CERTIFICATES.filter((c) => c.site === site), date.slice(0, 10));
