#!/usr/bin/env node
// Builds the demo content bundle (docs/DEMO-DATA.md, decision record 0018).
//   node scripts/build-demo-bundle.mjs [--manifest docs/demo-media-manifest.json] [--out dist]
// Reads the media manifest, fetches every file from its recorded source (a "repo:" path or an https URL), REFUSES any
// file without a recorded source, author, licence, licence URL and a passed privacy check, checks sizes, and packs ONE zip:
//   bundle.json        content manifest: bundle version, every file with sha256, size, licence, author, credit
//   media/...          the media payload (images, video)
//   text/...           the text payload (banner lines per media file, credits), kept apart from the media
// Writes cevoc-demo-bundle-<version>.zip and a .sha256 file next to it. No credentials are used. Deterministic output.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function fail(message) {
  console.error(`demo bundle: REFUSED. ${message}`);
  process.exit(1);
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const blank = (v) => typeof v !== 'string' || v.trim() === '';

export function checkEntry(f, limits) {
  const need = ['path', 'kind', 'contentType', 'source', 'sourceUrl', 'author', 'licence', 'licenceUrl', 'credit', 'retrieved', 'shows'];
  for (const k of need) {
    if (blank(f[k])) return `${f.path || '(no path)'} has no recorded ${k}`;
  }
  if (!/^media\/[A-Za-z0-9._-]{1,60}$/.test(f.path)) return `${f.path} is not a plain file name under media/`;
  if (!['image', 'video'].includes(f.kind)) return `${f.path} has an unknown kind`;
  if (!/^https:\/\//.test(f.licenceUrl)) return `${f.path} licence URL must be https`;
  if (!f.privacy || f.privacy.status !== 'checked' || blank(f.privacy.method)) return `${f.path} has no passed privacy check with a recorded method`;
  if (!f.source.startsWith('repo:') && !/^https:\/\//.test(f.source)) return `${f.path} source must be repo: or https://`;
  return null;
}

async function load(source) {
  if (source.startsWith('repo:')) {
    const p = resolve(root, source.slice(5));
    if (!p.startsWith(root + '/')) fail(`source ${source} leaves the repository`);
    return readFileSync(p);
  }
  const res = await fetch(source, { redirect: 'follow' });
  if (!res.ok) fail(`download of ${source} answered ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// Minimal deterministic zip writer (deflate, fixed timestamp), no dependency.
export function zip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  const time = 0;
  const date = (1 << 5) | 1; // 1980-01-01
  for (const [name, data] of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const comp = zlib.deflateRawSync(data, { level: 9 });
    const crc = zlib.crc32(data) >>> 0;
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt16LE(time, 10); h.writeUInt16LE(date, 12); h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nameBuf.length, 26);
    locals.push(h, nameBuf, comp);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt16LE(time, 12); c.writeUInt16LE(date, 14); c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nameBuf.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

async function main() {
  const manifestPath = resolve(root, arg('manifest', 'docs/demo-media-manifest.json'));
  const outDir = resolve(root, arg('out', 'dist'));
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (blank(m.bundleVersion) || !/^[A-Za-z0-9._-]{1,30}$/.test(m.bundleVersion)) fail('manifest has no valid bundleVersion');
  if (!Array.isArray(m.files) || m.files.length === 0) fail('manifest lists no files');
  const limits = m.limits || {};
  const max = { image: limits.imageMaxBytes ?? 3145728, video: limits.videoMaxBytes ?? 15728640 };
  const totalMax = limits.totalMaxBytes ?? 62914560;

  // Refuse first, before any download.
  for (const f of m.files) {
    const problem = checkEntry(f);
    if (problem) fail(problem);
  }
  const seen = new Set();
  const entries = [];
  const listed = [];
  let total = 0;
  for (const f of m.files) {
    if (seen.has(f.path)) fail(`${f.path} is listed twice`);
    seen.add(f.path);
    const data = await load(f.source);
    if (data.length === 0 || data.length > max[f.kind]) fail(`${f.path} is ${data.length} bytes, allowed 1 to ${max[f.kind]}`);
    total += data.length;
    entries.push([f.path, data]);
    listed.push({
      path: f.path, kind: f.kind, contentType: f.contentType, width: f.width ?? null, height: f.height ?? null,
      size: data.length, sha256: sha256(data), licence: f.licence, licenceUrl: f.licenceUrl, author: f.author,
      credit: f.credit, sourceUrl: f.sourceUrl, retrieved: f.retrieved,
    });
  }
  // The text payload, separate from the media: banner lines per media file, and the credits.
  const banners = {};
  for (const f of m.files) if (Array.isArray(f.banner) && f.banner.length) banners[f.path] = f.banner;
  const credits = m.files.map((f) => ({ path: f.path, credit: f.credit, author: f.author, licence: f.licence, licenceUrl: f.licenceUrl }));
  const textFiles = [['text/banners.json', Buffer.from(JSON.stringify(banners, null, 2) + '\n')],
    ['text/credits.json', Buffer.from(JSON.stringify(credits, null, 2) + '\n')]];
  for (const [path, data] of textFiles) {
    total += data.length;
    entries.push([path, data]);
    listed.push({ path, kind: 'text', contentType: 'application/json', width: null, height: null, size: data.length, sha256: sha256(data),
      licence: 'Project-original text', licenceUrl: 'https://github.com/save-the-lives/cevoc-prototype', author: 'CEVOC project',
      credit: 'CEVOC project', sourceUrl: 'derived from docs/demo-media-manifest.json', retrieved: m.files[0].retrieved });
  }
  if (total > totalMax) fail(`bundle content is ${total} bytes, allowed ${totalMax}`);
  const content = { bundleVersion: m.bundleVersion, format: 1, files: listed };
  entries.unshift(['bundle.json', Buffer.from(JSON.stringify(content, null, 2) + '\n')]);

  const archive = zip(entries);
  mkdirSync(outDir, { recursive: true });
  const name = `cevoc-demo-bundle-${m.bundleVersion}.zip`;
  writeFileSync(join(outDir, name), archive);
  const sum = sha256(archive);
  writeFileSync(join(outDir, `${name}.sha256`), `${sum}  ${name}\n`);
  console.log(`demo bundle: wrote ${name} (${archive.length} bytes, ${listed.length} files, version ${m.bundleVersion})`);
  console.log(`demo bundle: sha256 ${sum}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
