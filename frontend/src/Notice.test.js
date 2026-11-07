import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Notice step navigation', () => {
  const src = readFileSync(new URL('./Notice.jsx', import.meta.url), 'utf8');

  it('step links call preventDefault and scrollIntoView instead of navigating', () => {
    // The nav links must have an onClick that prevents the default hash navigation
    expect(src).toMatch(/e\.preventDefault\(\)/);
    expect(src).toMatch(/scrollIntoView\(\s*\{\s*behavior:\s*'smooth'\s*\}\s*\)/);
  });

  it('step link onClick is on the same <a> element as the href', () => {
    // The anchor in the toc must have both href (for accessibility) and onClick (to override navigation)
    const tocSection = src.match(/className="toc"[\s\S]*?<\/nav>/);
    expect(tocSection).not.toBeNull();
    const anchors = tocSection[0].match(/<a\s[^>]*>/g) || [];
    expect(anchors.length).toBeGreaterThan(0);
    for (const a of anchors) {
      expect(a).toMatch(/href=/);
      expect(a).toMatch(/onClick=/);
    }
  });

  it('no step link navigates away via bare href without an onClick handler', () => {
    // Find all <a href={...}> in the toc nav — each must also have onClick
    const tocSection = src.match(/className="toc"[\s\S]*?<\/nav>/);
    expect(tocSection).not.toBeNull();
    const anchors = tocSection[0].match(/<a\s[^>]*>/g) || [];
    expect(anchors.length).toBeGreaterThan(0);
    for (const a of anchors) {
      expect(a).toMatch(/onClick/);
    }
  });
});
