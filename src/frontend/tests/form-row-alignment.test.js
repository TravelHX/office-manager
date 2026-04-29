/**
 * @jest-environment jsdom
 *
 * Phase 30 / spec section 25: every input + adjacent action button row across
 * the app shares the `.form-row` layout class so the row renders on the same
 * Y axis. jsdom does NOT compute layout boxes (`getBoundingClientRect()`
 * returns zeroes), so this suite asserts the **structural** contract:
 *
 *   - The shipped HTML has `.form-row` on the row container.
 *   - Every interactive child (input, select, button) is a descendant of
 *     that row container, not of some sibling.
 *   - The CSS rule that pins the alignment primitives is present in
 *     `src/frontend/css/styles.css`.
 *
 * Real-pixel alignment is asserted by `tests/e2e/form-row-alignment.spec.js`
 * which renders the pages in a real browser.
 */

const fs = require('fs');
const path = require('path');

function readPage(rel) {
    return fs.readFileSync(path.resolve(__dirname, '../pages', rel), 'utf8');
}

function loadHTMLFragment(html) {
    document.body.innerHTML = html;
}

describe('Phase 30: shared .form-row layout', () => {
    describe('CSS contract', () => {
        const cssPath = path.resolve(__dirname, '../css/styles.css');
        const css = fs.readFileSync(cssPath, 'utf8');

        test('styles.css defines a .form-row rule', () => {
            // The block must declare the alignment primitives that pin the
            // row baseline. Match across newlines so the rule body is
            // captured even with formatting whitespace.
            const blockMatch = css.match(/\.form-row\s*\{[\s\S]*?\}/);
            expect(blockMatch).not.toBeNull();
            const block = blockMatch[0];
            expect(block).toMatch(/display:\s*flex/);
            expect(block).toMatch(/align-items:\s*flex-end/);
            expect(block).toMatch(/gap:/);
        });

        test('styles.css zeros .form-group margin-bottom inside a .form-row', () => {
            // The drift this CSS fixes: `.form-group` has `margin-bottom: 1.5rem`
            // which pushes labelled inputs above unlabelled buttons. Inside
            // a row the bottom margin must be zero so the bottoms truly align.
            const childMatch = css.match(/\.form-row\s+\.form-group\s*\{[\s\S]*?\}/);
            expect(childMatch).not.toBeNull();
            expect(childMatch[0]).toMatch(/margin-bottom:\s*0/);
        });

        test('styles.css pins a min-height on direct interactive children of a .form-row', () => {
            // Buttons / bare inputs that sit directly inside a `.form-row`
            // (no `.form-group` wrapper) need an explicit min-height so they
            // line up with the labelled inputs that DO have a wrapper.
            const directMatch = css.match(/\.form-row\s*>\s*button[\s\S]*?\}/);
            expect(directMatch).not.toBeNull();
            expect(directMatch[0]).toMatch(/min-height:/);
        });
    });

    describe('parking.html: date / time period / Check Availability', () => {
        beforeEach(() => loadHTMLFragment(readPage('parking.html')));

        test('the row container has the .form-row class', () => {
            const row = document.querySelector('.booking-form');
            expect(row).not.toBeNull();
            expect(row.classList.contains('form-row')).toBe(true);
        });

        test('reservationDate, timePeriod, and checkAvailabilityBtn are inside the row', () => {
            const row = document.querySelector('.booking-form.form-row');
            expect(row.querySelector('#reservationDate')).not.toBeNull();
            expect(row.querySelector('#timePeriod')).not.toBeNull();
            expect(row.querySelector('#checkAvailabilityBtn')).not.toBeNull();
        });
    });

    describe('desk-booking.html: start date / end date / Check Availability', () => {
        beforeEach(() => loadHTMLFragment(readPage('desk-booking.html')));

        test('the row container has the .form-row class', () => {
            const row = document.querySelector('.booking-form');
            expect(row).not.toBeNull();
            expect(row.classList.contains('form-row')).toBe(true);
        });

        test('startDate, endDate, and checkAvailabilityBtn are inside the row', () => {
            const row = document.querySelector('.booking-form.form-row');
            expect(row.querySelector('#startDate')).not.toBeNull();
            expect(row.querySelector('#endDate')).not.toBeNull();
            expect(row.querySelector('#checkAvailabilityBtn')).not.toBeNull();
        });
    });

    describe('bookings.html: search / status filter / type filter', () => {
        beforeEach(() => loadHTMLFragment(readPage('bookings.html')));

        test('the search-filter-group has the .form-row class', () => {
            const row = document.querySelector('.search-filter-group');
            expect(row).not.toBeNull();
            expect(row.classList.contains('form-row')).toBe(true);
        });

        test('search-input, status-filter, and type-filter are inside the row', () => {
            const row = document.querySelector('.search-filter-group.form-row');
            expect(row.querySelector('#search-input')).not.toBeNull();
            expect(row.querySelector('#status-filter')).not.toBeNull();
            expect(row.querySelector('#type-filter')).not.toBeNull();
        });
    });

    describe('matrix.html: filter row + Load Matrix / Export', () => {
        beforeEach(() => loadHTMLFragment(readPage('matrix.html')));

        test('the filters-panel has the .form-row class', () => {
            const row = document.querySelector('.filters-panel');
            expect(row).not.toBeNull();
            expect(row.classList.contains('form-row')).toBe(true);
        });

        test('startDate, endDate, viewType, three multi-selects, and both action buttons are inside the row', () => {
            const row = document.querySelector('.filters-panel.form-row');
            expect(row.querySelector('#startDate')).not.toBeNull();
            expect(row.querySelector('#endDate')).not.toBeNull();
            expect(row.querySelector('#viewType')).not.toBeNull();
            expect(row.querySelector('#userFilter')).not.toBeNull();
            expect(row.querySelector('#deskFilter')).not.toBeNull();
            expect(row.querySelector('#parkingFilter')).not.toBeNull();
            expect(row.querySelector('#loadMatrixBtn')).not.toBeNull();
            expect(row.querySelector('#exportMatrixBtn')).not.toBeNull();
        });
    });

    describe('admin.html: audit search row', () => {
        beforeEach(() => loadHTMLFragment(readPage('admin.html')));

        test('the audit search row has the .form-row class', () => {
            // Find the audit-tab search-filter-group (admin.html has more
            // than one search-filter-group; locate by its known children).
            const auditInput = document.getElementById('audit-search-input');
            expect(auditInput).not.toBeNull();
            const row = auditInput.closest('.search-filter-group');
            expect(row).not.toBeNull();
            expect(row.classList.contains('form-row')).toBe(true);
        });

        test('audit search input, Search button, and Clear button are siblings inside the row', () => {
            const auditInput = document.getElementById('audit-search-input');
            const row = auditInput.closest('.search-filter-group.form-row');
            expect(row.querySelector('#audit-search-btn')).not.toBeNull();
            expect(row.querySelector('#audit-clear-search-btn')).not.toBeNull();
        });

        test('the maps upload row already uses .form-row (pre-existing)', () => {
            const uploadForm = document.getElementById('map-upload-form');
            expect(uploadForm).not.toBeNull();
            expect(uploadForm.classList.contains('form-row')).toBe(true);
        });
    });
});
