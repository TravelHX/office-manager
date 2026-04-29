// Phase 32.9: unit tests for the server-side SVG sanitiser.
//
// Pins the security-critical behaviour of src/backend/utils/svg-sanitizer.js:
// every attack vector listed in spec section 27 / todo task 32.3 has its own
// red-green test here. If a future refactor relaxes any of these rules the
// suite must fail loudly.

const { sanitizeSvg, isSafeHrefValue, looksLikeSvg } = require('../../src/backend/utils/svg-sanitizer');

describe('svg-sanitizer.sanitizeSvg', () => {
  test('returns a syntactically intact SVG when the input is already safe', () => {
    const safe = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
    expect(sanitizeSvg(safe)).toContain('<svg');
    expect(sanitizeSvg(safe)).toContain('<rect');
  });

  test('accepts a BOM-prefixed document and strips the BOM', () => {
    const safe = '﻿<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    const out = sanitizeSvg(safe);
    expect(out.charCodeAt(0)).not.toBe(0xFEFF);
    expect(out).toContain('<svg');
  });

  test('accepts a Buffer input', () => {
    const safe = Buffer.from('<svg><rect/></svg>', 'utf8');
    expect(sanitizeSvg(safe)).toContain('<svg');
  });

  test('strips <script> blocks (open + close)', () => {
    const dirty = '<svg><script>alert(1)</script><rect/></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/alert\(1\)/);
    expect(clean).toContain('<rect/>');
  });

  test('strips self-closing <script /> tags', () => {
    const dirty = '<svg><script src="https://evil/x.js" /><rect/></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toMatch(/<script/i);
    expect(clean).toContain('<rect/>');
  });

  test('strips on* attributes regardless of element', () => {
    const dirty = '<svg onload="alert(1)"><rect onclick="x()" width="10"/></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toMatch(/onload/i);
    expect(clean).not.toMatch(/onclick/i);
    expect(clean).not.toMatch(/alert\(1\)/);
    // Non-event attributes survive.
    expect(clean).toContain('width="10"');
  });

  test('strips on* attributes with single-quoted, unquoted, and mixed values', () => {
    const dirty = `<svg onload='a()' onerror=b() onclick="c()"><rect/></svg>`;
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toMatch(/on[a-z]+\s*=/i);
  });

  test('strips <foreignObject> blocks', () => {
    const dirty = '<svg><foreignObject><div>hi</div></foreignObject><rect/></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toMatch(/<foreignObject/i);
    expect(clean).not.toMatch(/<div>/);
    expect(clean).toContain('<rect/>');
  });

  test('rejects DOCTYPE with an ENTITY declaration', () => {
    const xxe = `<?xml version="1.0"?>
<!DOCTYPE svg [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<svg><text>&xxe;</text></svg>`;
    expect(() => sanitizeSvg(xxe)).toThrow(/ENTITY/);
  });

  test('rejects the billion-laughs ENTITY pattern', () => {
    const lol = `<!DOCTYPE svg [
  <!ENTITY lol "lol">
  <!ENTITY lol2 "&lol;&lol;">
]>
<svg><text>&lol2;</text></svg>`;
    expect(() => sanitizeSvg(lol)).toThrow(/ENTITY/);
  });

  test('preserves a safe relative href', () => {
    const dirty = '<svg><a href="/desks/1.png"><rect/></a></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).toContain('href="/desks/1.png"');
  });

  test('preserves a fragment-only href', () => {
    const dirty = '<svg><use href="#shape"/></svg>';
    expect(sanitizeSvg(dirty)).toContain('href="#shape"');
  });

  test('preserves xlink:href the same way as href', () => {
    const dirty = '<svg><use xlink:href="#shape"/></svg>';
    expect(sanitizeSvg(dirty)).toContain('xlink:href="#shape"');
  });

  test('strips javascript: href values', () => {
    const dirty = `<svg><a href="javascript:alert(1)"><rect/></a></svg>`;
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toMatch(/javascript:/i);
    // Attribute remains as href="" so the surrounding tag stays valid.
    expect(clean).toMatch(/href=""/);
  });

  test('strips javascript: xlink:href values', () => {
    const dirty = `<svg><a xlink:href="javascript:alert(1)"><rect/></a></svg>`;
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toMatch(/javascript:/i);
    expect(clean).toMatch(/xlink:href=""/);
  });

  test('strips other dangerous href schemes', () => {
    const dirty = `<svg>
      <a href="vbscript:msgbox"/>
      <a href="file:///etc/passwd"/>
      <a href="//evil.example/"/>
      <a xlink:href="mailto:x@y"/>
    </svg>`;
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toMatch(/vbscript:/i);
    expect(clean).not.toMatch(/file:/i);
    expect(clean).not.toMatch(/mailto:/i);
    expect(clean).not.toMatch(/\/\/evil/i);
  });

  test('strips data: URIs that are not known-safe images', () => {
    const dirty = `<svg><image href="data:text/html;base64,PHNjcmlwdD4="/></svg>`;
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toMatch(/data:text\/html/);
    expect(clean).toMatch(/href=""/);
  });

  test('strips data:image/svg+xml URIs (no recursion)', () => {
    const dirty = `<svg><image href="data:image/svg+xml;base64,PHN2Zz4="/></svg>`;
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toMatch(/data:image\/svg/);
  });

  test('preserves data:image/png;base64 URIs', () => {
    const safe = `<svg><image href="data:image/png;base64,iVBORw0KGgo="/></svg>`;
    const clean = sanitizeSvg(safe);
    expect(clean).toContain('data:image/png;base64,iVBORw0KGgo=');
  });

  test('throws on null / non-string / non-Buffer input', () => {
    expect(() => sanitizeSvg(null)).toThrow(/Invalid SVG/);
    expect(() => sanitizeSvg(undefined)).toThrow(/Invalid SVG/);
    expect(() => sanitizeSvg(42)).toThrow(/Invalid SVG/);
    expect(() => sanitizeSvg({})).toThrow(/Invalid SVG/);
  });

  test('throws on empty / whitespace-only input', () => {
    expect(() => sanitizeSvg('')).toThrow(/Invalid SVG/);
    expect(() => sanitizeSvg('   \n\t')).toThrow(/Invalid SVG/);
  });

  test('throws when the document does not begin with an SVG-shaped token', () => {
    expect(() => sanitizeSvg('<html><body/></html>')).toThrow(/Invalid SVG/);
    expect(() => sanitizeSvg('plain text')).toThrow(/Invalid SVG/);
  });

  test('throws when there is no <svg> root tag', () => {
    expect(() => sanitizeSvg('<?xml version="1.0"?><notsvg/>')).toThrow(/Invalid SVG/);
  });

  test('idempotent: sanitising an already-safe document is a no-op', () => {
    const safe = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1"/></svg>';
    expect(sanitizeSvg(sanitizeSvg(safe))).toBe(sanitizeSvg(safe));
  });
});

describe('svg-sanitizer.isSafeHrefValue', () => {
  test('empty / fragment / relative are safe', () => {
    expect(isSafeHrefValue('')).toBe(true);
    expect(isSafeHrefValue('#shape')).toBe(true);
    expect(isSafeHrefValue('relative/path.png')).toBe(true);
    expect(isSafeHrefValue('/absolute/path.png')).toBe(true);
    expect(isSafeHrefValue('./sibling.png')).toBe(true);
  });

  test('protocol-relative is rejected', () => {
    expect(isSafeHrefValue('//evil.example/x')).toBe(false);
  });

  test('javascript: vbscript: file: mailto: rejected', () => {
    expect(isSafeHrefValue('javascript:alert(1)')).toBe(false);
    expect(isSafeHrefValue('JavaScript:alert(1)')).toBe(false);
    expect(isSafeHrefValue('vbscript:msgbox')).toBe(false);
    expect(isSafeHrefValue('file:///etc/passwd')).toBe(false);
    expect(isSafeHrefValue('mailto:x@y')).toBe(false);
    expect(isSafeHrefValue('http://example/')).toBe(false);
    expect(isSafeHrefValue('https://example/')).toBe(false);
  });

  test('data: image URIs only accepted when base64 + safe media type', () => {
    expect(isSafeHrefValue('data:image/png;base64,AAA')).toBe(true);
    expect(isSafeHrefValue('data:image/jpeg;base64,AAA')).toBe(true);
    expect(isSafeHrefValue('data:image/gif;base64,AAA')).toBe(true);
    expect(isSafeHrefValue('data:image/svg+xml;base64,AAA')).toBe(false);
    expect(isSafeHrefValue('data:text/html;base64,AAA')).toBe(false);
    expect(isSafeHrefValue('data:image/png,not-base64')).toBe(false);
  });

  test('a colon in a path segment is treated as a relative path', () => {
    // The colon after `time` is not a scheme separator because `/` precedes it.
    expect(isSafeHrefValue('/api/maps/desk:image')).toBe(true);
  });
});

describe('svg-sanitizer.looksLikeSvg', () => {
  test('recognises common SVG-shaped opens', () => {
    expect(looksLikeSvg('<?xml version="1.0"?><svg/>')).toBe(true);
    expect(looksLikeSvg('<!-- a comment --><svg/>')).toBe(true);
    expect(looksLikeSvg('<!DOCTYPE svg><svg/>')).toBe(true);
    expect(looksLikeSvg('<svg xmlns="..."/>')).toBe(true);
    expect(looksLikeSvg('   \n<svg/>')).toBe(true);
  });

  test('recognises a Buffer and tolerates a BOM', () => {
    expect(looksLikeSvg(Buffer.from('﻿<svg/>', 'utf8'))).toBe(true);
  });

  test('rejects non-SVG payloads', () => {
    expect(looksLikeSvg('<html><body/></html>')).toBe(false);
    expect(looksLikeSvg('plain text')).toBe(false);
    expect(looksLikeSvg('')).toBe(false);
    expect(looksLikeSvg(null)).toBe(false);
    expect(looksLikeSvg(undefined)).toBe(false);
    expect(looksLikeSvg({})).toBe(false);
  });
});
