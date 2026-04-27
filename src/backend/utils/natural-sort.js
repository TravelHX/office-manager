// natural-sort.js — Phase 24.
//
// Comparator for "natural" / human-friendly ordering of desk and parking
// space identifiers. Identifiers are typically numeric strings ("1", "2",
// "10") but the schema also allows alphanumeric values ("A1", "A2",
// "A10") under manual numbering. Both must sort intuitively so users
// don't see "1, 10, 11, 2, 3" anywhere in the product.
//
// Algorithm:
//   1. Tokenise each input into runs of digits and runs of non-digits.
//   2. Compare token-by-token. Digit-vs-digit compares numerically;
//      otherwise compare as case-insensitive strings.
//   3. If one side runs out of tokens first, the shorter one is smaller.
//   4. Tie-breaker: the original full string (case-sensitive) so the
//      result is deterministic even when two inputs differ only in case.
//
// Frontend has its own copy under src/frontend/js/natural-sort.js with
// matching behaviour so that server- and client-rendered orders agree.

const TOKEN_REGEX = /(\d+)|(\D+)/g;

/**
 * Compare two ids in natural order. Suitable for Array.prototype.sort.
 * @param {string|number|null|undefined} a
 * @param {string|number|null|undefined} b
 * @returns {number}
 */
function compareNaturalIds(a, b) {
  const aMissing = a === null || a === undefined || a === '';
  const bMissing = b === null || b === undefined || b === '';
  if (aMissing && bMissing) return 0;
  if (aMissing) return -1;
  if (bMissing) return 1;

  const sa = String(a);
  const sb = String(b);

  const tokensA = sa.match(TOKEN_REGEX) || [];
  const tokensB = sb.match(TOKEN_REGEX) || [];
  const len = Math.min(tokensA.length, tokensB.length);

  for (let i = 0; i < len; i += 1) {
    const ta = tokensA[i];
    const tb = tokensB[i];
    const aIsDigit = /^\d+$/.test(ta);
    const bIsDigit = /^\d+$/.test(tb);

    if (aIsDigit && bIsDigit) {
      const na = parseInt(ta, 10);
      const nb = parseInt(tb, 10);
      if (na !== nb) return na - nb;
      // Same numeric value but different lengths means leading zeros
      // (e.g. "01" vs "1"). Fall through to lexical compare so sort is
      // deterministic.
      if (ta.length !== tb.length) return ta.length - tb.length;
    } else if (aIsDigit) {
      // Digits sort before non-digits so "1A" precedes "A1" intuitively.
      return -1;
    } else if (bIsDigit) {
      return 1;
    } else {
      const ca = ta.toLowerCase();
      const cb = tb.toLowerCase();
      if (ca < cb) return -1;
      if (ca > cb) return 1;
    }
  }

  if (tokensA.length !== tokensB.length) {
    return tokensA.length - tokensB.length;
  }

  // Final stability tie-breaker on the original (case-sensitive) string so
  // 'A1' and 'a1' have a fixed deterministic ordering.
  if (sa < sb) return -1;
  if (sa > sb) return 1;
  return 0;
}

/**
 * Build a comparator that sorts objects by `obj[propName]`.
 * @param {string} propName
 */
function byProperty(propName) {
  return (a, b) => compareNaturalIds(a && a[propName], b && b[propName]);
}

/**
 * Return a NEW array sorted by `propName` in natural order. The original
 * array is left unmutated so callers can safely sort cached or shared
 * data.
 */
function sortByProperty(items, propName) {
  if (!Array.isArray(items)) return items;
  return items.slice().sort(byProperty(propName));
}

module.exports = {
  compareNaturalIds,
  byProperty,
  sortByProperty,
};
