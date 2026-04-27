// natural-sort.js — Phase 24 frontend mirror of
// src/backend/utils/natural-sort.js.
//
// The two implementations MUST behave identically so server- and
// client-rendered orderings of desks / parking spaces match. If you
// change one, change the other and re-run both unit suites.
//
// Loaded as a plain <script> tag and exposed on globalThis so vanilla-JS
// page scripts can call it without an import system.

(function () {
    'use strict';

    const TOKEN_REGEX = /(\d+)|(\D+)/g;

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
                if (ta.length !== tb.length) return ta.length - tb.length;
            } else if (aIsDigit) {
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
        if (sa < sb) return -1;
        if (sa > sb) return 1;
        return 0;
    }

    function byProperty(propName) {
        return (a, b) => compareNaturalIds(a && a[propName], b && b[propName]);
    }

    function sortByProperty(items, propName) {
        if (!Array.isArray(items)) return items;
        return items.slice().sort(byProperty(propName));
    }

    globalThis.NaturalSort = {
        compareNaturalIds,
        byProperty,
        sortByProperty,
    };

    // Also export under CommonJS so Jest can require this file directly
    // when frontend tests want to exercise the same comparator.
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { compareNaturalIds, byProperty, sortByProperty };
    }
})();
