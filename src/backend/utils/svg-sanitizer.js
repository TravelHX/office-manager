// Phase 32: server-side SVG sanitiser.
//
// Strips active content from an admin-uploaded SVG floor plan before it is
// written to disk. The sanitiser runs against an UTF-8 string and returns a
// sanitised UTF-8 string. The original bytes are not retained.
//
// Hardening rules (per docs/spec.md section 27 and todo.md task 32.3):
//
//   * Strip every `<script>` element (and its descendants).
//   * Strip every `on*` attribute on every element (onclick, onload, onerror, ...).
//   * Strip every `<foreignObject>` element (and its descendants).
//   * Reject the document outright when its `<!DOCTYPE>` declaration contains
//     an `<!ENTITY ...>` definition (XXE / billion-laughs prevention).
//     We deliberately reject rather than try to strip, because targeted
//     entity rewriting is fragile and the legitimate use case for ENTITY in
//     a floor plan is approximately zero.
//   * Rewrite `href` and `xlink:href` attributes:
//       - Allow same-origin relative URIs (no scheme, no `//` prefix).
//       - Allow fragment refs (`#id`).
//       - Allow `data:` URIs whose declared media type is `image/png`,
//         `image/jpeg`, `image/gif`, or `image/svg+xml` AND whose content is
//         base64-encoded (i.e. the sanitiser does not try to recursively
//         parse a `data:image/svg+xml,...` URI). For raw SVG embedded as a
//         data URI we rewrite the attribute to an empty string rather than
//         trying to recurse.
//       - Reject `javascript:`, `vbscript:`, `file:`, and every other
//         scheme. Rejected attributes are removed.
//   * Throw a clear "invalid SVG" error if the document cannot be parsed,
//     or the root element is not `<svg>`.
//
// The implementation is intentionally regex-driven rather than DOM-based:
// pulling in a full XML parser (libxmljs / sax / xmldom) would add a native
// dependency and a parser-bug attack surface that the project has so far
// avoided. The rules above are constrained enough to express as ordered
// substring rewrites against the raw SVG text. The companion unit suite in
// tests/utils/svg-sanitizer.test.js pins the behaviour.

'use strict';

const SCRIPT_BLOCK = /<script\b[^>]*?(?:\/>|>[\s\S]*?<\/script\s*>)/gi;
const FOREIGN_OBJECT_BLOCK = /<foreignObject\b[^>]*?(?:\/>|>[\s\S]*?<\/foreignObject\s*>)/gi;

// Match `on*=` attributes regardless of quote style. The leading whitespace
// guard prevents matching e.g. `xmlns:on=` (no whitespace before `on`).
const ON_ATTRIBUTE = /\s+on[a-z][a-z0-9-]*\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;

// Match `href=` and `xlink:href=` attributes, capturing the quoted value.
const HREF_ATTRIBUTE = /(\s+(?:xlink:)?href\s*=\s*)("[^"]*"|'[^']*')/gi;

// DOCTYPE that contains an ENTITY declaration anywhere in its bracketed
// internal subset. Multi-line; tolerant of arbitrary whitespace.
const DOCTYPE_WITH_ENTITY = /<!DOCTYPE\b[^>\[]*\[[\s\S]*?<!ENTITY\b[\s\S]*?\]\s*>/i;

// Recognise that a buffer is plausibly an SVG document. Used by the magic-byte
// sniff in the upload route — exported so the route and the sanitiser agree
// on what counts as "SVG-shaped". After optional UTF-8 BOM and whitespace
// the first non-blank token must be `<?xml`, `<!--`, `<!DOCTYPE`, or `<svg`.
const SVG_HEAD = /^[\s﻿]*(<\?xml\b|<!--|<!DOCTYPE\b|<svg\b)/i;

/**
 * Test whether the given Buffer or string looks like an SVG document at the
 * byte level (per spec section 27 / todo task 32.2).
 *
 * @param {Buffer|string} input
 * @returns {boolean}
 */
function looksLikeSvg(input) {
  if (input == null) return false;
  let head;
  if (Buffer.isBuffer(input)) {
    // Sniff at most the first 256 bytes to avoid scanning a multi-megabyte
    // payload — the recognition tokens are all very short.
    head = input.slice(0, 256).toString('utf8');
  } else if (typeof input === 'string') {
    head = input.slice(0, 256);
  } else {
    return false;
  }
  return SVG_HEAD.test(head);
}

/**
 * Sanitise an SVG document. Throws an Error("Invalid SVG ...") when the
 * input cannot be safely processed.
 *
 * @param {string|Buffer} input - UTF-8 SVG source.
 * @returns {string} sanitised UTF-8 SVG source.
 */
function sanitizeSvg(input) {
  if (input == null) {
    throw new Error('Invalid SVG: input is empty');
  }
  let svg;
  if (Buffer.isBuffer(input)) {
    svg = input.toString('utf8');
  } else if (typeof input === 'string') {
    svg = input;
  } else {
    throw new Error('Invalid SVG: expected string or Buffer');
  }

  // Strip optional BOM so the head sniff and the parser agree on offsets.
  if (svg.charCodeAt(0) === 0xFEFF) {
    svg = svg.slice(1);
  }

  if (!svg.trim()) {
    throw new Error('Invalid SVG: input is empty');
  }

  // 1. Reject DOCTYPE-with-ENTITY before any other rewrite. This is the only
  //    rule that aborts; every other rule scrubs and continues.
  if (DOCTYPE_WITH_ENTITY.test(svg)) {
    throw new Error('Invalid SVG: DOCTYPE with ENTITY declaration is not allowed');
  }

  // 2. Confirm the document at least *starts* like an SVG.
  if (!SVG_HEAD.test(svg)) {
    throw new Error('Invalid SVG: document does not begin with <?xml, <!--, <!DOCTYPE, or <svg');
  }

  // 3. Confirm a `<svg ...>` root tag is present somewhere. We don't enforce
  //    that it is *the* outermost tag (an XML prolog or comment may precede
  //    it) but we do require its presence.
  if (!/<svg\b/i.test(svg)) {
    throw new Error('Invalid SVG: no <svg> root element');
  }

  // 4. Strip <script> blocks (open + close OR self-closing).
  svg = svg.replace(SCRIPT_BLOCK, '');

  // 5. Strip <foreignObject> blocks.
  svg = svg.replace(FOREIGN_OBJECT_BLOCK, '');

  // 6. Strip on* attributes everywhere they appear.
  svg = svg.replace(ON_ATTRIBUTE, '');

  // 7. Sanitise href / xlink:href values.
  svg = svg.replace(HREF_ATTRIBUTE, (match, prefix, quotedValue) => {
    const quote = quotedValue.charAt(0);
    const value = quotedValue.slice(1, -1).trim();
    if (isSafeHrefValue(value)) {
      return `${prefix}${quote}${value}${quote}`;
    }
    // Empty href keeps the attribute syntactically valid without exposing
    // the rejected target. Browsers treat href="" as a same-page reference,
    // which is harmless for floor-plan rendering.
    return `${prefix}${quote}${quote}`;
  });

  // 8. Final guard: re-check that no <script> survived a malformed
  //    intermediate structure. If we still see one, refuse to ship the
  //    file rather than risk a sneaky bypass.
  if (/<script\b/i.test(svg) || /<foreignObject\b/i.test(svg)) {
    throw new Error('Invalid SVG: residual script or foreignObject content after sanitisation');
  }

  return svg;
}

/**
 * Decide whether the value of an href / xlink:href attribute is safe to keep.
 *
 * Allowed:
 *   - empty string
 *   - fragment-only refs (`#id`)
 *   - relative paths (no scheme, no protocol-relative `//`)
 *   - `data:` URIs declaring a safe image media type AND base64-encoded
 *     (we do not recurse into nested SVG data URIs)
 *
 * Rejected:
 *   - everything else, including `javascript:`, `vbscript:`, `file:`,
 *     `http(s)://`, `mailto:`, protocol-relative `//host/...`, and any
 *     `data:` URI that isn't a known-safe image type.
 *
 * @param {string} value
 * @returns {boolean}
 */
function isSafeHrefValue(value) {
  if (value === '' || value == null) return true;
  if (value.startsWith('#')) return true;

  // Protocol-relative URIs are explicitly rejected — they bypass scheme
  // sniffing by inheriting the page scheme.
  if (value.startsWith('//')) return false;

  // No colon at all → relative path → safe.
  const colon = value.indexOf(':');
  if (colon < 0) return true;

  // Colon further into the string than the first '/' or '?' or '#' → it's
  // a path segment containing a colon, not a scheme.
  const slash = value.indexOf('/');
  const question = value.indexOf('?');
  const hash = value.indexOf('#');
  const reservedPositions = [slash, question, hash].filter((i) => i >= 0);
  if (reservedPositions.length > 0 && Math.min(...reservedPositions) < colon) {
    return true;
  }

  const scheme = value.slice(0, colon).toLowerCase();
  if (scheme !== 'data') return false;

  // data:[<mime>][;base64],<payload>
  const rest = value.slice(colon + 1);
  const comma = rest.indexOf(',');
  if (comma < 0) return false;
  const meta = rest.slice(0, comma).toLowerCase();
  const allowedDataTypes = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
  ];
  // Require base64 to dodge raw SVG/HTML payloads, and require one of the
  // known-safe raster types. SVG-in-data-URI is intentionally rejected.
  if (!meta.includes(';base64')) return false;
  const declaredType = meta.split(';')[0];
  return allowedDataTypes.includes(declaredType);
}

module.exports = {
  sanitizeSvg,
  isSafeHrefValue,
  looksLikeSvg,
};
