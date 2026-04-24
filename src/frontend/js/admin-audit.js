// Admin audit log UI (Phase 21c).
//
// Self-contained module for the Admin > Audit tab. Calls the read-only
// GET /api/admin/audit-events endpoint (Phase 21b) and renders a table with
// a search box and limit/offset pagination. No emission wiring yet — the
// table will be empty until Phase 21d hooks AuditService.logEvent into
// mutating flows.
//
// Loaded from src/frontend/pages/admin.html via <script>; depends on
// globalThis.apiRequest (from main.js). All functions are exposed on
// window for testability (mirroring desk-booking.js / parking.js).

(function () {
    'use strict';

    const apiRequest = (endpoint, options) => {
        const impl = globalThis.apiRequest;
        if (typeof impl !== 'function') {
            throw new Error('apiRequest is not registered; load main.js before admin-audit.js.');
        }
        return impl(endpoint, options);
    };

    const AUDIT_PAGE_SIZE = 50;

    // Module-local pagination + search state. Re-initialised on each fresh
    // tab activation via loadAuditEvents.
    const auditState = {
        offset: 0,
        limit: AUDIT_PAGE_SIZE,
        search: '',
        lastPageCount: 0,
    };

    /**
     * Escape HTML special characters so payload/summary text renders as text
     * rather than being interpreted as markup. Admin-only UI, but audit rows
     * echo user-provided content (emails, bookings) that must not execute.
     */
    function escapeHtml(value) {
        if (value === null || value === undefined) {
            return '';
        }
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatOccurredAt(value) {
        if (!value) return '';
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            return escapeHtml(value);
        }
        return date.toLocaleString('en-GB', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    }

    function formatActor(event) {
        if (event.actorEmail) return escapeHtml(event.actorEmail);
        if (event.actorId != null) return `user ${escapeHtml(event.actorId)}`;
        return '<span class="text-muted">system</span>';
    }

    function formatTarget(event) {
        if (!event.targetType && event.targetId == null) return '';
        const type = escapeHtml(event.targetType || '');
        const id = event.targetId != null ? escapeHtml(event.targetId) : '';
        return id ? `${type} #${id}` : type;
    }

    function formatPayload(payload) {
        if (payload === null || payload === undefined) return '';
        try {
            return escapeHtml(JSON.stringify(payload));
        } catch (_err) {
            return escapeHtml(String(payload));
        }
    }

    function renderAuditTable(events) {
        if (!events || events.length === 0) {
            return '<p>No audit events found.</p>';
        }
        return `
            <table class="audit-events-table">
                <thead>
                    <tr>
                        <th>When</th>
                        <th>Actor</th>
                        <th>Action</th>
                        <th>Target</th>
                        <th>Summary</th>
                        <th>Payload</th>
                    </tr>
                </thead>
                <tbody>
                    ${events.map((event) => `
                        <tr>
                            <td>${formatOccurredAt(event.occurredAt)}</td>
                            <td>${formatActor(event)}</td>
                            <td><code>${escapeHtml(event.actionType)}</code></td>
                            <td>${formatTarget(event)}</td>
                            <td>${escapeHtml(event.summary || '')}</td>
                            <td><code>${formatPayload(event.payload)}</code></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function updatePaginationControls() {
        const prevBtn = document.getElementById('audit-prev-btn');
        const nextBtn = document.getElementById('audit-next-btn');
        const pageIndicator = document.getElementById('audit-page-indicator');
        if (prevBtn) prevBtn.disabled = auditState.offset === 0;
        // If the last page returned fewer rows than the limit, there's no next page.
        if (nextBtn) nextBtn.disabled = auditState.lastPageCount < auditState.limit;
        if (pageIndicator) {
            const startIndex = auditState.offset + 1;
            const endIndex = auditState.offset + auditState.lastPageCount;
            if (auditState.lastPageCount === 0) {
                pageIndicator.textContent = 'No events';
            } else {
                pageIndicator.textContent = `Showing ${startIndex}-${endIndex}`;
            }
        }
    }

    async function loadAuditEvents(offset = 0, search = '') {
        const container = document.getElementById('audit-events-container');
        if (!container) return;

        auditState.offset = Math.max(0, Number(offset) || 0);
        auditState.search = typeof search === 'string' ? search : '';

        container.innerHTML = '<p>Loading audit events...</p>';

        const params = new URLSearchParams();
        params.set('limit', String(auditState.limit));
        params.set('offset', String(auditState.offset));
        if (auditState.search.trim()) {
            params.set('search', auditState.search.trim());
        }

        try {
            const response = await apiRequest(`/api/admin/audit-events?${params.toString()}`);
            const events = Array.isArray(response && response.events) ? response.events : [];
            auditState.lastPageCount = events.length;
            container.innerHTML = renderAuditTable(events);
            updatePaginationControls();
        } catch (error) {
            auditState.lastPageCount = 0;
            container.innerHTML = `<div class="error">Failed to load audit events: ${escapeHtml(error.message || '')}</div>`;
            updatePaginationControls();
        }
    }

    function onSearchClicked() {
        const input = document.getElementById('audit-search-input');
        const search = input ? input.value : '';
        loadAuditEvents(0, search);
    }

    function onClearSearchClicked() {
        const input = document.getElementById('audit-search-input');
        if (input) input.value = '';
        loadAuditEvents(0, '');
    }

    function onNextPageClicked() {
        loadAuditEvents(auditState.offset + auditState.limit, auditState.search);
    }

    function onPrevPageClicked() {
        loadAuditEvents(Math.max(0, auditState.offset - auditState.limit), auditState.search);
    }

    /**
     * Wire up the search/pagination buttons once the audit tab DOM is
     * present. Called from admin.js DOMContentLoaded; safe to call multiple
     * times (each listener is added exactly once per element).
     */
    function initAuditTabControls() {
        const searchBtn = document.getElementById('audit-search-btn');
        if (searchBtn && !searchBtn.dataset.auditWired) {
            searchBtn.addEventListener('click', onSearchClicked);
            searchBtn.dataset.auditWired = '1';
        }
        const clearBtn = document.getElementById('audit-clear-search-btn');
        if (clearBtn && !clearBtn.dataset.auditWired) {
            clearBtn.addEventListener('click', onClearSearchClicked);
            clearBtn.dataset.auditWired = '1';
        }
        const input = document.getElementById('audit-search-input');
        if (input && !input.dataset.auditWired) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    onSearchClicked();
                }
            });
            input.dataset.auditWired = '1';
        }
        const prevBtn = document.getElementById('audit-prev-btn');
        if (prevBtn && !prevBtn.dataset.auditWired) {
            prevBtn.addEventListener('click', onPrevPageClicked);
            prevBtn.dataset.auditWired = '1';
        }
        const nextBtn = document.getElementById('audit-next-btn');
        if (nextBtn && !nextBtn.dataset.auditWired) {
            nextBtn.addEventListener('click', onNextPageClicked);
            nextBtn.dataset.auditWired = '1';
        }
    }

    // Test-friendly surface (same pattern as desk-booking.js / parking.js).
    if (typeof window !== 'undefined') {
        window.loadAuditEvents = loadAuditEvents;
        window.renderAuditTable = renderAuditTable;
        window.initAuditTabControls = initAuditTabControls;
        window.auditState = auditState;
        window._auditEscapeHtml = escapeHtml;
    }
})();
