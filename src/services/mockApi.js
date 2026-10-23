// Mock service layer. Stands in for the target API so screens don't talk to data directly.
// ctx = { outage: boolean, overrides: { [contentId]: status } }
import { NOTICES, SITES, CERTIFICATES } from '../data/mockData.js';

export class UpstreamError extends Error {
  constructor() {
    super('Source system unavailable');
    this.name = 'UpstreamError';
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const withStatus = (item, overrides) => ({ ...item, status: overrides[item.id] ?? item.status });

async function call(ctx, fn) {
  await wait(ctx.latency ?? 300);
  if (ctx.outage) throw new UpstreamError();
  return fn();
}

export const api = {
  lookupNotice: (ctx, number, rego) =>
    call(ctx, () => {
      const n = NOTICES.find((x) => x.number === number && x.rego === rego.toUpperCase().replace(/\s/g, ''));
      if (!n) return null;
      if (n.upstreamFailure) throw new UpstreamError();
      return {
        ...n,
        images: n.images.map((i) => withStatus(i, ctx.overrides)),
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
    call(ctx, () =>
      CERTIFICATES.filter((c) => c.site === code)
        .map((c) => withStatus(c, ctx.overrides))
        .sort((a, b) => b.validFrom.localeCompare(a.validFrom))
    ),

  getCertificate: (ctx, id) =>
    call(ctx, () => {
      const c = CERTIFICATES.find((x) => x.id === id);
      return c ? withStatus(c, ctx.overrides) : null;
    }),

  officerSearch: (ctx, { site, from, to }) =>
    call(ctx, () =>
      CERTIFICATES.filter(
        (c) => (!site || c.site === site) && (!from || c.validTo >= from) && (!to || c.validFrom <= to)
      )
        .map((c) => withStatus(c, ctx.overrides))
        .sort((a, b) => a.site.localeCompare(b.site) || b.validFrom.localeCompare(a.validFrom))
    ),
};

// Business rules shared by screens
export const applicableOn = (certs, date) =>
  certs.find((c) => c.status === 'published' && c.validFrom <= date && c.validTo >= date) || null;

export const publicCertificates = (certs) => certs.filter((c) => c.status !== 'restricted');

export const can = (officer, permission) => !!officer && officer.permissions.includes(permission);
