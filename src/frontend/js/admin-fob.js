// Phase 27c: Admin UI for the Key Fob subsystem.
//
// Three tabs in one self-contained module:
//   - Fob Management: set the default daily fob count + manage per-date
//     overrides (set / remove).
//   - Fob Calendar: per-day required vs available report over a chosen
//     date range.
//   - Fob History: past allocations for the chosen range, with CSV
//     export.
//
// Backend lives behind /api/admin/fob/* (Phase 27b). Authorisation is
// enforced server-side: regular Users get 403, Office Administrators
// and Administrators both reach 200.
//
// Loaded from src/frontend/pages/admin.html via <script>; depends on
// globalThis.apiRequest, getAuthToken, escapeHtml from main.js.

(function () {
    'use strict';

    const apiRequest = (endpoint, options) => {
        const impl = globalThis.apiRequest;
        if (typeof impl !== 'function') {
            throw new Error('apiRequest is not registered; load main.js before admin-fob.js.');
        }
        return impl(endpoint, options);
    };

    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ----------------------------------------------------------------
    // Fob Management
    // ----------------------------------------------------------------

    /**
     * Load current default + overrides and render the management view.
     * Lazy-called when the Fob Management tab opens.
     */
    async function loadFobManagement() {
        const defaultInput = document.getElementById('fobDefaultCount');
        const overridesContainer = document.getElementById('fob-overrides-container');
        if (!defaultInput || !overridesContainer) return;
        try {
            const inv = await apiRequest('/api/admin/fob/inventory');
            defaultInput.value = (inv && inv.default !== null && inv.default !== undefined)
                ? String(inv.default)
                : '';
            renderFobOverrides(inv && Array.isArray(inv.overrides) ? inv.overrides : []);
        } catch (error) {
            overridesContainer.innerHTML = '<p>Failed to load fob inventory.</p>';
            const msg = document.getElementById('fob-overrides-message');
            if (msg) msg.innerHTML = `<div class="error">${escapeHtml(error.message || 'Unknown error')}</div>`;
        }
    }

    /** Render the per-date overrides list. Each row has a Remove button. */
    function renderFobOverrides(overrides) {
        const container = document.getElementById('fob-overrides-container');
        if (!container) return;
        if (!overrides.length) {
            container.innerHTML = '<p>No per-date overrides configured.</p>';
            return;
        }
        const rows = overrides.map((o) => `
            <tr>
                <td>${escapeHtml(o.date)}</td>
                <td>${escapeHtml(String(o.count))}</td>
                <td>
                    <button type="button" class="btn-danger fob-override-remove-btn" data-date="${escapeHtml(o.date)}">Remove</button>
                </td>
            </tr>
        `).join('');
        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Count</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
        container.querySelectorAll('.fob-override-remove-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const d = btn.getAttribute('data-date');
                if (!d) return;
                if (!window.confirm(`Remove the fob override for ${d}? The default daily count will apply again.`)) {
                    return;
                }
                removeFobOverride(d);
            });
        });
    }

    async function saveFobDefault() {
        const input = document.getElementById('fobDefaultCount');
        const msg = document.getElementById('fob-default-message');
        if (!input) return;
        if (msg) msg.innerHTML = '';
        const raw = input.value;
        if (raw === '' || raw === null || raw === undefined) {
            if (msg) msg.innerHTML = '<div class="error">Enter a number to set the default count.</div>';
            return;
        }
        const count = parseInt(raw, 10);
        if (Number.isNaN(count) || count < 0) {
            if (msg) msg.innerHTML = '<div class="error">Default count must be a non-negative integer.</div>';
            return;
        }
        try {
            await apiRequest('/api/admin/fob/inventory/default', {
                method: 'PUT',
                body: { count },
            });
            if (msg) msg.innerHTML = `<div class="success">Default fob count saved (${count}).</div>`;
            loadFobManagement();
        } catch (error) {
            if (msg) msg.innerHTML = `<div class="error">${escapeHtml(error.message || 'Failed to save default')}</div>`;
        }
    }

    async function saveFobOverride() {
        const dateInput = document.getElementById('fobOverrideDate');
        const countInput = document.getElementById('fobOverrideCount');
        const msg = document.getElementById('fob-overrides-message');
        if (!dateInput || !countInput) return;
        if (msg) msg.innerHTML = '';
        const date = dateInput.value;
        const raw = countInput.value;
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            if (msg) msg.innerHTML = '<div class="error">Pick a date.</div>';
            return;
        }
        if (raw === '' || raw === null) {
            if (msg) msg.innerHTML = '<div class="error">Enter a count for the override.</div>';
            return;
        }
        const count = parseInt(raw, 10);
        if (Number.isNaN(count) || count < 0) {
            if (msg) msg.innerHTML = '<div class="error">Count must be a non-negative integer.</div>';
            return;
        }
        try {
            await apiRequest(`/api/admin/fob/inventory/${encodeURIComponent(date)}`, {
                method: 'PUT',
                body: { count },
            });
            if (msg) msg.innerHTML = `<div class="success">Override saved for ${escapeHtml(date)} = ${count}.</div>`;
            countInput.value = '';
            loadFobManagement();
        } catch (error) {
            if (msg) msg.innerHTML = `<div class="error">${escapeHtml(error.message || 'Failed to save override')}</div>`;
        }
    }

    async function removeFobOverride(date) {
        const msg = document.getElementById('fob-overrides-message');
        if (msg) msg.innerHTML = '';
        try {
            await apiRequest(`/api/admin/fob/inventory/${encodeURIComponent(date)}`, {
                method: 'DELETE',
            });
            if (msg) msg.innerHTML = `<div class="success">Override removed for ${escapeHtml(date)}.</div>`;
            loadFobManagement();
        } catch (error) {
            if (msg) msg.innerHTML = `<div class="error">${escapeHtml(error.message || 'Failed to remove override')}</div>`;
        }
    }

    function initFobManagementControls() {
        const defaultBtn = document.getElementById('fobDefaultSaveBtn');
        if (defaultBtn && !defaultBtn.dataset.fobWired) {
            defaultBtn.addEventListener('click', saveFobDefault);
            defaultBtn.dataset.fobWired = '1';
        }
        const overrideBtn = document.getElementById('fobOverrideSaveBtn');
        if (overrideBtn && !overrideBtn.dataset.fobWired) {
            overrideBtn.addEventListener('click', saveFobOverride);
            overrideBtn.dataset.fobWired = '1';
        }
    }

    // ----------------------------------------------------------------
    // Fob Calendar
    // ----------------------------------------------------------------

    async function loadFobCalendar() {
        const startInput = document.getElementById('fobCalendarStart');
        const endInput = document.getElementById('fobCalendarEnd');
        const container = document.getElementById('fob-calendar-container');
        const msg = document.getElementById('fob-calendar-message');
        if (!startInput || !endInput || !container) return;
        if (msg) msg.innerHTML = '';
        const startDate = startInput.value;
        const endDate = endInput.value;
        if (!startDate || !endDate) {
            container.innerHTML = '<p>Pick a start and end date.</p>';
            return;
        }
        if (startDate > endDate) {
            container.innerHTML = '';
            if (msg) msg.innerHTML = '<div class="error">Start date must be on or before end date.</div>';
            return;
        }
        try {
            container.innerHTML = '<p>Loading calendar…</p>';
            const data = await apiRequest(
                `/api/admin/fob/calendar?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
            );
            renderFobCalendar(data);
        } catch (error) {
            container.innerHTML = '<p>Failed to load calendar.</p>';
            if (msg) msg.innerHTML = `<div class="error">${escapeHtml(error.message || 'Unknown error')}</div>`;
        }
    }

    function renderFobCalendar(data) {
        const container = document.getElementById('fob-calendar-container');
        if (!container) return;
        const days = (data && Array.isArray(data.days)) ? data.days : [];
        if (!days.length) {
            container.innerHTML = '<p>No days in the selected range.</p>';
            return;
        }
        const rows = days.map((d) => {
            const configured = (d.configured === null || d.configured === undefined)
                ? '<span class="text-muted">—</span>'
                : escapeHtml(String(d.configured));
            const available = (d.available === null || d.available === undefined)
                ? '<span class="text-muted">—</span>'
                : escapeHtml(String(d.available));
            const exhaustedClass = (d.configured !== null && d.available === 0) ? ' fob-day-exhausted' : '';
            return `
                <tr class="fob-calendar-row${exhaustedClass}">
                    <td>${escapeHtml(d.date)}</td>
                    <td>${configured}</td>
                    <td>${escapeHtml(String(d.requested))}</td>
                    <td>${available}</td>
                </tr>
            `;
        }).join('');
        container.innerHTML = `
            <table class="fob-calendar-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Configured</th>
                        <th>Requested</th>
                        <th>Available</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    function initFobCalendarControls() {
        const btn = document.getElementById('fobCalendarLoadBtn');
        if (btn && !btn.dataset.fobWired) {
            btn.addEventListener('click', loadFobCalendar);
            btn.dataset.fobWired = '1';
        }
        // Default the date range to "this month" so the tab is useful on
        // first open without forcing the admin to pick dates first.
        const startInput = document.getElementById('fobCalendarStart');
        const endInput = document.getElementById('fobCalendarEnd');
        if (startInput && !startInput.value) {
            const now = new Date();
            const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
            startInput.value = isoDate(first);
        }
        if (endInput && !endInput.value) {
            const now = new Date();
            // Last day of current month: day 0 of the next month.
            const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
            endInput.value = isoDate(last);
        }
    }

    // ----------------------------------------------------------------
    // Fob History
    // ----------------------------------------------------------------

    async function loadFobHistory() {
        const startInput = document.getElementById('fobHistoryStart');
        const endInput = document.getElementById('fobHistoryEnd');
        const container = document.getElementById('fob-history-container');
        const msg = document.getElementById('fob-history-message');
        if (!startInput || !endInput || !container) return;
        if (msg) msg.innerHTML = '';
        const startDate = startInput.value;
        const endDate = endInput.value;
        if (!startDate || !endDate) {
            container.innerHTML = '<p>Pick a start and end date.</p>';
            return;
        }
        if (startDate > endDate) {
            container.innerHTML = '';
            if (msg) msg.innerHTML = '<div class="error">Start date must be on or before end date.</div>';
            return;
        }
        try {
            container.innerHTML = '<p>Loading history…</p>';
            const data = await apiRequest(
                `/api/admin/fob/history?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
            );
            renderFobHistory(data);
        } catch (error) {
            container.innerHTML = '<p>Failed to load history.</p>';
            if (msg) msg.innerHTML = `<div class="error">${escapeHtml(error.message || 'Unknown error')}</div>`;
        }
    }

    function renderFobHistory(data) {
        const container = document.getElementById('fob-history-container');
        if (!container) return;
        const rows = (data && Array.isArray(data.rows)) ? data.rows : [];
        if (!rows.length) {
            container.innerHTML = '<p>No fob allocations in the selected range.</p>';
            return;
        }
        const body = rows.map((r) => `
            <tr>
                <td>${escapeHtml(String(r.id))}</td>
                <td>${escapeHtml(r.userName || '')}</td>
                <td>${escapeHtml(r.userEmail || '')}</td>
                <td>${escapeHtml(String(r.deskNumber || ''))}</td>
                <td>${escapeHtml(r.startDate || '')}</td>
                <td>${escapeHtml(r.endDate || '')}</td>
                <td><span class="status-badge status-${escapeHtml(r.status || '')}">${escapeHtml(r.status || '')}</span></td>
            </tr>
        `).join('');
        container.innerHTML = `
            <table class="fob-history-table">
                <thead>
                    <tr>
                        <th>Booking ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Desk</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>${body}</tbody>
            </table>
        `;
    }

    /**
     * Trigger a CSV download for the current range. We use the auth
     * header so the request is authenticated; a plain <a href> would
     * not carry the JWT. The blob URL is revoked once the synthetic
     * click has fired so the page doesn't leak handles.
     */
    async function exportFobHistoryCsv() {
        const startInput = document.getElementById('fobHistoryStart');
        const endInput = document.getElementById('fobHistoryEnd');
        const msg = document.getElementById('fob-history-message');
        if (!startInput || !endInput) return;
        const startDate = startInput.value;
        const endDate = endInput.value;
        if (!startDate || !endDate) {
            if (msg) msg.innerHTML = '<div class="error">Pick a start and end date before exporting.</div>';
            return;
        }
        if (startDate > endDate) {
            if (msg) msg.innerHTML = '<div class="error">Start date must be on or before end date.</div>';
            return;
        }
        try {
            const tokenFn = (typeof globalThis.getAuthToken === 'function') ? globalThis.getAuthToken : null;
            const token = tokenFn ? tokenFn() : null;
            const url = `/api/admin/fob/history?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&format=csv`;
            const headers = { Accept: 'text/csv' };
            if (token) headers.Authorization = `Bearer ${token}`;
            const res = await fetch(url, { headers });
            if (!res.ok) {
                const body = await res.text();
                throw new Error(`CSV download failed: HTTP ${res.status} ${body}`);
            }
            const text = await res.text();
            const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `fob-history-${startDate}-to-${endDate}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
            if (msg) msg.innerHTML = '<div class="success">CSV download started.</div>';
        } catch (error) {
            if (msg) msg.innerHTML = `<div class="error">${escapeHtml(error.message || 'Unknown error')}</div>`;
        }
    }

    function initFobHistoryControls() {
        const loadBtn = document.getElementById('fobHistoryLoadBtn');
        if (loadBtn && !loadBtn.dataset.fobWired) {
            loadBtn.addEventListener('click', loadFobHistory);
            loadBtn.dataset.fobWired = '1';
        }
        const csvBtn = document.getElementById('fobHistoryExportBtn');
        if (csvBtn && !csvBtn.dataset.fobWired) {
            csvBtn.addEventListener('click', exportFobHistoryCsv);
            csvBtn.dataset.fobWired = '1';
        }
        // Sensible default range: last 30 days through today.
        const startInput = document.getElementById('fobHistoryStart');
        const endInput = document.getElementById('fobHistoryEnd');
        if (startInput && !startInput.value) {
            const d = new Date();
            d.setUTCDate(d.getUTCDate() - 30);
            startInput.value = isoDate(d);
        }
        if (endInput && !endInput.value) {
            endInput.value = isoDate(new Date());
        }
    }

    function isoDate(d) {
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    // Test-friendly surface (mirrors admin-audit.js).
    if (typeof window !== 'undefined') {
        window.loadFobManagement = loadFobManagement;
        window.renderFobOverrides = renderFobOverrides;
        window.saveFobDefault = saveFobDefault;
        window.saveFobOverride = saveFobOverride;
        window.removeFobOverride = removeFobOverride;
        window.initFobManagementControls = initFobManagementControls;
        window.loadFobCalendar = loadFobCalendar;
        window.renderFobCalendar = renderFobCalendar;
        window.initFobCalendarControls = initFobCalendarControls;
        window.loadFobHistory = loadFobHistory;
        window.renderFobHistory = renderFobHistory;
        window.initFobHistoryControls = initFobHistoryControls;
        window.exportFobHistoryCsv = exportFobHistoryCsv;
        window._fobEscapeHtml = escapeHtml;
    }
})();
