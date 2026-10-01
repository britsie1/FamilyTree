import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { socialImageUrl } from '../scripts/socialPreview.ts';

describe('social preview', () => {
  it('creates absolute image URLs and preserves deployment base paths', () => {
    assert.equal(socialImageUrl('https://example.com'), 'https://example.com/social-preview.png');
    assert.equal(socialImageUrl('https://example.com/app?tree=private#person'), 'https://example.com/app/social-preview.png');
    assert.equal(socialImageUrl('https://example.com/app/'), 'https://example.com/app/social-preview.png');
  });

  it('rejects invalid URLs and credentials', () => {
    for (const url of ['not-a-url', 'ftp://example.com', 'https://user:password@example.com']) {
      assert.throws(() => socialImageUrl(url));
    }
  });

  it('includes static metadata and a 1200 by 630 PNG', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    for (const property of ['og:title', 'og:description', 'og:image', 'og:image:alt', 'og:image:width', 'og:image:height']) {
      assert.ok(html.includes(`property="${property}"`));
    }
    assert.ok(html.includes('content="summary_large_image"'));
    const png = readFileSync(new URL('../public/social-preview.png', import.meta.url));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 630);
    assert.ok(png.length < 300_000, 'Keep the preview image small for messaging crawlers');
  });
});