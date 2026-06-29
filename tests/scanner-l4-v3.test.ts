import { describe, it, expect } from 'vitest';
import {
  checkStructuredDataQuality,
  checkEntityCoverage,
  checkContentFreshness,
} from '../src/scanner.js';

function jsonLd(obj: unknown): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify(obj)}</script></head><body></body></html>`;
}

describe('4.13 Structured Data Quality', () => {
  it('passes when a typed block has >= 3 meaningful properties', () => {
    const html = jsonLd({ '@context': 'https://schema.org', '@type': 'Organization', name: 'Acme', url: 'https://acme.com', description: 'x', logo: 'l.png' });
    const r = checkStructuredDataQuality(html);
    expect(r.status).toBe('pass');
    expect(r.message).toContain('4 meaningful properties');
  });

  it('reads typed nodes nested in @graph', () => {
    const html = jsonLd({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite', name: 'a', url: 'b', description: 'c' }] });
    expect(checkStructuredDataQuality(html).status).toBe('pass');
  });

  it('is partial when a typed block is too thin', () => {
    const html = jsonLd({ '@type': 'Thing', name: 'a' });
    expect(checkStructuredDataQuality(html).status).toBe('partial');
  });

  it('fails when there is no typed JSON-LD', () => {
    expect(checkStructuredDataQuality('<html></html>').status).toBe('fail');
  });

  it('fails when homepage could not be fetched', () => {
    expect(checkStructuredDataQuality(null).status).toBe('fail');
  });
});

describe('4.14 Entity Coverage', () => {
  it('passes and counts sameAs links (array)', () => {
    const html = jsonLd({ '@type': 'Organization', name: 'Acme', sameAs: ['https://x.com/a', 'https://linkedin.com/a', 'https://wikipedia.org/a'] });
    const r = checkEntityCoverage(html);
    expect(r.status).toBe('pass');
    expect(r.message).toContain('3 sameAs links');
  });

  it('passes with a single string sameAs', () => {
    const html = jsonLd({ '@type': 'Person', sameAs: 'https://x.com/joey' });
    const r = checkEntityCoverage(html);
    expect(r.status).toBe('pass');
    expect(r.message).toContain('1 sameAs link');
  });

  it('fails when there are no sameAs links', () => {
    const html = jsonLd({ '@type': 'Organization', name: 'Acme' });
    expect(checkEntityCoverage(html).status).toBe('fail');
  });
});

describe('4.15 Content Freshness', () => {
  it('passes on JSON-LD dateModified', () => {
    const html = jsonLd({ '@type': 'WebPage', dateModified: '2026-06-28' });
    expect(checkContentFreshness(html).status).toBe('pass');
  });

  it('passes on an article:modified_time meta tag', () => {
    const html = '<html><head><meta property="article:modified_time" content="2026-06-28T00:00:00Z"></head></html>';
    expect(checkContentFreshness(html).status).toBe('pass');
  });

  it('passes on a <time datetime> element', () => {
    const html = '<html><body><time datetime="2026-06-28">today</time></body></html>';
    expect(checkContentFreshness(html).status).toBe('pass');
  });

  it('fails when no freshness signal is present', () => {
    expect(checkContentFreshness('<html><body>hello</body></html>').status).toBe('fail');
  });
});
