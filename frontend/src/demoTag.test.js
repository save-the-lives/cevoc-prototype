import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import DemoTag from './DemoBanner.jsx';

describe('Demo data tag', () => {
  const html = renderToStaticMarkup(createElement(DemoTag));
  it('is real text with a sensible accessible name', () => {
    expect(html).toContain('Demo data');
    expect(html).toContain('aria-label="Demo data: this page shows sample information"');
    expect(html).toContain('role="note"');
  });
  it('is a small inline tag, not a row', () => {
    expect(html.startsWith('<span')).toBe(true);
    const css = readFileSync(new URL('./demo.css', import.meta.url), 'utf8');
    expect(css).not.toMatch(/\.demo-banner/);
    expect(css).toMatch(/\.demo-tag-head[^}]*margin-left: auto/);
    expect(css).toMatch(/\.demo-tag-head[^}]*background: #5a2d82/);
  });
  it('lives in the NSW Government header and only for the DEMO source', () => {
    const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');
    expect(app).toMatch(/className="masthead"><div className="wrap">NSW Government\{live\?\.details\?\.source === 'DEMO' && <DemoTag \/>\}/);
    expect(app.match(/<DemoTag/g)).toHaveLength(1);
  });
});
