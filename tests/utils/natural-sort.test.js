// Phase 24 unit tests for the natural-sort utility.
//
// The utility powers ordering of desk numbers and parking space numbers
// across every view in the product. Identifiers are typically purely
// numeric ("1", "2", "10") but the schema also allows manual alphanumeric
// values ("A1", "A10", "B1"). Both must sort intuitively: numeric runs
// compare as numbers, non-numeric runs compare as strings, and ties at
// every segment fall back to the full original string so the sort is
// stable.
//
// These tests are written before the implementation lands (TDD red);
// once `src/backend/utils/natural-sort.js` exists, run this file to
// confirm the green phase.

const naturalSort = require('../../src/backend/utils/natural-sort');

describe('compareNaturalIds', () => {
  test('compares purely numeric identifiers numerically', () => {
    expect(naturalSort.compareNaturalIds('2', '10')).toBeLessThan(0);
    expect(naturalSort.compareNaturalIds('10', '2')).toBeGreaterThan(0);
    expect(naturalSort.compareNaturalIds('5', '5')).toBe(0);
  });

  test('handles single-digit / multi-digit boundaries', () => {
    const ids = ['10', '1', '11', '2', '3'];
    const sorted = ids.slice().sort(naturalSort.compareNaturalIds);
    expect(sorted).toEqual(['1', '2', '3', '10', '11']);
  });

  test('compares alphanumeric identifiers letter-then-number', () => {
    expect(naturalSort.compareNaturalIds('A2', 'A10')).toBeLessThan(0);
    expect(naturalSort.compareNaturalIds('A10', 'B1')).toBeLessThan(0);
    expect(naturalSort.compareNaturalIds('B1', 'A99')).toBeGreaterThan(0);
  });

  test('orders mixed alphanumeric set correctly', () => {
    const ids = ['B1', 'A10', 'A2', 'A1'];
    const sorted = ids.slice().sort(naturalSort.compareNaturalIds);
    expect(sorted).toEqual(['A1', 'A2', 'A10', 'B1']);
  });

  test('treats null / undefined / empty as smaller than any non-empty value', () => {
    expect(naturalSort.compareNaturalIds(null, '1')).toBeLessThan(0);
    expect(naturalSort.compareNaturalIds(undefined, '1')).toBeLessThan(0);
    expect(naturalSort.compareNaturalIds('', '1')).toBeLessThan(0);
    expect(naturalSort.compareNaturalIds(null, undefined)).toBe(0);
  });

  test('coerces numeric arguments without throwing', () => {
    expect(naturalSort.compareNaturalIds(2, 10)).toBeLessThan(0);
    expect(naturalSort.compareNaturalIds(10, 2)).toBeGreaterThan(0);
    expect(naturalSort.compareNaturalIds('1', 1)).toBe(0);
  });

  test('is case-insensitive for the alphabetic segments', () => {
    expect(naturalSort.compareNaturalIds('a1', 'A2')).toBeLessThan(0);
    expect(naturalSort.compareNaturalIds('a10', 'A2')).toBeGreaterThan(0);
  });

  test('breaks segment ties with the original string for stability', () => {
    // "A1" and "a1" tie under case-insensitive comparison; the tie-break
    // must produce a deterministic ordering rather than depend on JS
    // engine sort stability.
    const a = naturalSort.compareNaturalIds('A1', 'a1');
    const b = naturalSort.compareNaturalIds('a1', 'A1');
    expect(a + b).toBe(0);
    expect(a).not.toBe(0);
  });
});

describe('byProperty', () => {
  test('returns a comparator that orders objects by the named property', () => {
    const desks = [
      { id: 3, deskNumber: '10' },
      { id: 1, deskNumber: '2' },
      { id: 2, deskNumber: '1' },
    ];
    desks.sort(naturalSort.byProperty('deskNumber'));
    expect(desks.map((d) => d.deskNumber)).toEqual(['1', '2', '10']);
  });

  test('handles a missing property as the smallest possible value', () => {
    const items = [{ n: '2' }, {}, { n: '1' }];
    items.sort(naturalSort.byProperty('n'));
    expect(items.map((i) => i.n)).toEqual([undefined, '1', '2']);
  });
});

describe('sortByProperty', () => {
  test('does not mutate the input array', () => {
    const input = [{ n: '10' }, { n: '2' }];
    const out = naturalSort.sortByProperty(input, 'n');
    expect(input.map((i) => i.n)).toEqual(['10', '2']);
    expect(out.map((i) => i.n)).toEqual(['2', '10']);
  });

  test('returns the same array shape (length, references stay)', () => {
    const a = { n: '1' };
    const b = { n: '2' };
    const out = naturalSort.sortByProperty([b, a], 'n');
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(a);
    expect(out[1]).toBe(b);
  });

  test('handles an 11+ element list — the case where alphabetic sort visibly fails', () => {
    const input = [];
    for (let i = 1; i <= 11; i += 1) input.push({ n: String(i) });
    const out = naturalSort.sortByProperty(input, 'n');
    expect(out.map((i) => i.n)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
  });
});
