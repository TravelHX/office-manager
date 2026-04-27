/**
 * @jest-environment jsdom
 */

// Phase 24 frontend tests for src/frontend/js/natural-sort.js. Mirrors the
// backend tests in tests/utils/natural-sort.test.js so server- and
// client-side ordering match. If you change one suite, change the other.

const NaturalSort = require('../js/natural-sort.js');

describe('NaturalSort.compareNaturalIds (frontend mirror)', () => {
  test('numeric: 1, 2, 3, 10, 11', () => {
    const ids = ['10', '1', '11', '2', '3'];
    expect(ids.slice().sort(NaturalSort.compareNaturalIds))
      .toEqual(['1', '2', '3', '10', '11']);
  });

  test('alphanumeric: A1, A2, A10, B1', () => {
    const ids = ['B1', 'A10', 'A2', 'A1'];
    expect(ids.slice().sort(NaturalSort.compareNaturalIds))
      .toEqual(['A1', 'A2', 'A10', 'B1']);
  });

  test('treats null/undefined/empty as smaller than non-empty', () => {
    expect(NaturalSort.compareNaturalIds(null, '1')).toBeLessThan(0);
    expect(NaturalSort.compareNaturalIds('', '1')).toBeLessThan(0);
  });

  test('case-insensitive comparison with deterministic tie-break', () => {
    const a = NaturalSort.compareNaturalIds('A1', 'a1');
    const b = NaturalSort.compareNaturalIds('a1', 'A1');
    expect(a + b).toBe(0);
    expect(a).not.toBe(0);
  });

  test('11+ element list — the visible alphabetic-fail case', () => {
    const items = [];
    for (let i = 1; i <= 11; i += 1) items.push({ n: String(i) });
    const out = NaturalSort.sortByProperty(items, 'n');
    expect(out.map((i) => i.n)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
  });

  test('sortByProperty does not mutate input', () => {
    const input = [{ n: '10' }, { n: '2' }];
    const out = NaturalSort.sortByProperty(input, 'n');
    expect(input.map((i) => i.n)).toEqual(['10', '2']);
    expect(out.map((i) => i.n)).toEqual(['2', '10']);
  });

  test('exposes itself on globalThis when loaded as a script', () => {
    // Re-execute the IIFE in a fresh context to assert the globalThis hook.
    delete globalThis.NaturalSort;
    jest.resetModules();
    require('../js/natural-sort.js');
    expect(globalThis.NaturalSort).toBeDefined();
    expect(typeof globalThis.NaturalSort.compareNaturalIds).toBe('function');
  });
});
