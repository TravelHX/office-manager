/**
 * @jest-environment jsdom
 *
 * Phase 21c: admin audit tab (UI for the Phase 21b GET /api/admin/audit-events
 * endpoint). Tests load the real `admin-audit.js` module, not a mirror of its
 * logic, so behaviour drift between the UI and the tests will surface here.
 */

function loadAuditAdminModule() {
    // Minimal DOM that matches the audit-tab slice of admin.html.
    document.body.innerHTML = `
        <div id="audit-tab" class="tab-content">
            <div class="search-filter-group">
                <input type="text" id="audit-search-input" />
                <button id="audit-search-btn">Search</button>
                <button id="audit-clear-search-btn">Clear</button>
            </div>
            <div id="audit-events-container"></div>
            <button id="audit-prev-btn" disabled>Previous</button>
            <span id="audit-page-indicator"></span>
            <button id="audit-next-btn" disabled>Next</button>
        </div>
    `;
    jest.resetModules();
    globalThis.apiRequest = jest.fn();
    require('../js/admin-audit.js');
    // admin-audit.js is an IIFE: it wires window.* synchronously on require.
    window.initAuditTabControls();
}

describe('Phase 21c: admin audit tab', () => {
    beforeEach(() => {
        loadAuditAdminModule();
    });

    describe('loadAuditEvents', () => {
        test('calls GET /api/admin/audit-events with default limit=50 and offset=0', async () => {
            globalThis.apiRequest.mockResolvedValueOnce({ events: [], limit: 50, offset: 0 });
            await window.loadAuditEvents();

            expect(globalThis.apiRequest).toHaveBeenCalledTimes(1);
            const url = globalThis.apiRequest.mock.calls[0][0];
            expect(url).toContain('/api/admin/audit-events?');
            expect(url).toContain('limit=50');
            expect(url).toContain('offset=0');
            expect(url).not.toContain('search=');
        });

        test('includes search query in the URL when provided', async () => {
            globalThis.apiRequest.mockResolvedValueOnce({ events: [], limit: 50, offset: 0 });
            await window.loadAuditEvents(0, 'login failure');

            const url = globalThis.apiRequest.mock.calls[0][0];
            expect(url).toContain('search=login+failure');
        });

        test('trims whitespace-only search before deciding whether to include it', async () => {
            globalThis.apiRequest.mockResolvedValueOnce({ events: [], limit: 50, offset: 0 });
            await window.loadAuditEvents(0, '   ');
            const url = globalThis.apiRequest.mock.calls[0][0];
            expect(url).not.toContain('search=');
        });

        test('renders "No audit events found." when the response is empty', async () => {
            globalThis.apiRequest.mockResolvedValueOnce({ events: [], limit: 50, offset: 0 });
            await window.loadAuditEvents();
            const container = document.getElementById('audit-events-container');
            expect(container.innerHTML).toContain('No audit events found');
        });

        test('renders one row per event with expected columns', async () => {
            globalThis.apiRequest.mockResolvedValueOnce({
                events: [
                    {
                        id: 1,
                        occurredAt: '2026-04-24 09:00:00',
                        actorId: 5,
                        actorEmail: 'alice@test.com',
                        actionType: 'DESK_BOOKING_CREATED',
                        targetType: 'booking',
                        targetId: 101,
                        summary: 'Booked desk D001',
                        payload: { desk_id: 3 },
                        ipAddress: '10.0.0.1',
                    },
                    {
                        id: 2,
                        occurredAt: '2026-04-24 09:05:00',
                        actorId: null,
                        actorEmail: null,
                        actionType: 'AUTH_LOGIN_FAILURE',
                        targetType: null,
                        targetId: null,
                        summary: null,
                        payload: { attempted_email: 'bob@test.com' },
                        ipAddress: '10.0.0.2',
                    },
                ],
                limit: 50,
                offset: 0,
            });

            await window.loadAuditEvents();

            const container = document.getElementById('audit-events-container');
            const rows = container.querySelectorAll('tbody tr');
            expect(rows).toHaveLength(2);

            // First row: bound email, action code, target, summary, payload.
            expect(rows[0].textContent).toContain('alice@test.com');
            expect(rows[0].textContent).toContain('DESK_BOOKING_CREATED');
            expect(rows[0].textContent).toContain('booking #101');
            expect(rows[0].textContent).toContain('Booked desk D001');
            expect(rows[0].textContent).toContain('desk_id');

            // Second row: system actor, no target, payload present.
            expect(rows[1].textContent).toContain('system');
            expect(rows[1].textContent).toContain('AUTH_LOGIN_FAILURE');
            expect(rows[1].textContent).toContain('bob@test.com');
        });

        test('shows an error banner when the API rejects', async () => {
            globalThis.apiRequest.mockRejectedValueOnce(new Error('server on fire'));
            await window.loadAuditEvents();
            const container = document.getElementById('audit-events-container');
            expect(container.innerHTML).toContain('Failed to load audit events');
            expect(container.innerHTML).toContain('server on fire');
        });

        test('escapes HTML in summary and payload to prevent XSS', async () => {
            globalThis.apiRequest.mockResolvedValueOnce({
                events: [
                    {
                        id: 99,
                        occurredAt: '2026-04-24 09:00:00',
                        actorEmail: 'hack@test.com',
                        actionType: 'USER_CREATED',
                        targetType: 'user',
                        targetId: 7,
                        summary: '<script>alert("xss")</script>',
                        payload: { note: '<img src=x onerror=alert(1)>' },
                    },
                ],
                limit: 50,
                offset: 0,
            });

            await window.loadAuditEvents();
            const container = document.getElementById('audit-events-container');
            // The literal opening tag must not appear as HTML — escaped entities only.
            expect(container.innerHTML).not.toContain('<script>alert');
            expect(container.innerHTML).toContain('&lt;script&gt;');
            expect(container.innerHTML).not.toContain('<img src=x');
            expect(container.innerHTML).toContain('&lt;img');
        });
    });

    describe('pagination', () => {
        test('Next is disabled when the last page returned fewer rows than the limit', async () => {
            globalThis.apiRequest.mockResolvedValueOnce({
                events: [
                    { id: 1, occurredAt: '2026-04-24 09:00:00', actionType: 'AUTH_LOGOUT', actorEmail: null },
                ],
                limit: 50,
                offset: 0,
            });
            await window.loadAuditEvents();
            expect(document.getElementById('audit-next-btn').disabled).toBe(true);
            expect(document.getElementById('audit-prev-btn').disabled).toBe(true);
        });

        test('Next is enabled when the page is full (may have more data)', async () => {
            const full = Array.from({ length: 50 }, (_, i) => ({
                id: i + 1,
                occurredAt: '2026-04-24 09:00:00',
                actionType: 'AUTH_LOGOUT',
                actorEmail: null,
            }));
            globalThis.apiRequest.mockResolvedValueOnce({ events: full, limit: 50, offset: 0 });
            await window.loadAuditEvents();
            expect(document.getElementById('audit-next-btn').disabled).toBe(false);
        });

        test('clicking Next advances the offset by the page size', async () => {
            const full = Array.from({ length: 50 }, (_, i) => ({
                id: i + 1,
                occurredAt: '2026-04-24 09:00:00',
                actionType: 'AUTH_LOGOUT',
                actorEmail: null,
            }));
            globalThis.apiRequest.mockResolvedValue({ events: full, limit: 50, offset: 0 });
            await window.loadAuditEvents();
            globalThis.apiRequest.mockClear();
            globalThis.apiRequest.mockResolvedValueOnce({ events: full, limit: 50, offset: 50 });

            document.getElementById('audit-next-btn').click();
            // Let the async click handler flush.
            await Promise.resolve();
            await Promise.resolve();

            expect(globalThis.apiRequest).toHaveBeenCalledTimes(1);
            expect(globalThis.apiRequest.mock.calls[0][0]).toContain('offset=50');
        });

        test('clicking Previous decrements the offset, clamped at zero', async () => {
            const full = Array.from({ length: 50 }, (_, i) => ({
                id: i + 1,
                occurredAt: '2026-04-24 09:00:00',
                actionType: 'AUTH_LOGOUT',
                actorEmail: null,
            }));
            // First seed the state at offset=100.
            globalThis.apiRequest.mockResolvedValue({ events: full, limit: 50, offset: 100 });
            await window.loadAuditEvents(100, '');
            globalThis.apiRequest.mockClear();

            document.getElementById('audit-prev-btn').click();
            await Promise.resolve();
            await Promise.resolve();

            expect(globalThis.apiRequest).toHaveBeenCalledTimes(1);
            expect(globalThis.apiRequest.mock.calls[0][0]).toContain('offset=50');
        });
    });

    describe('search controls', () => {
        test('clicking Search sends the input value as the search query and resets offset', async () => {
            globalThis.apiRequest.mockResolvedValue({ events: [], limit: 50, offset: 0 });

            const input = document.getElementById('audit-search-input');
            input.value = 'AUTH_LOGIN';
            document.getElementById('audit-search-btn').click();
            await Promise.resolve();
            await Promise.resolve();

            expect(globalThis.apiRequest).toHaveBeenCalledTimes(1);
            const url = globalThis.apiRequest.mock.calls[0][0];
            expect(url).toContain('search=AUTH_LOGIN');
            expect(url).toContain('offset=0');
        });

        test('clicking Clear empties the input and reloads without a search query', async () => {
            globalThis.apiRequest.mockResolvedValue({ events: [], limit: 50, offset: 0 });
            const input = document.getElementById('audit-search-input');
            input.value = 'something';

            document.getElementById('audit-clear-search-btn').click();
            await Promise.resolve();
            await Promise.resolve();

            expect(input.value).toBe('');
            const url = globalThis.apiRequest.mock.calls[0][0];
            expect(url).not.toContain('search=');
        });

        test('pressing Enter in the search input triggers a search', async () => {
            globalThis.apiRequest.mockResolvedValue({ events: [], limit: 50, offset: 0 });
            const input = document.getElementById('audit-search-input');
            input.value = 'bob';

            const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
            input.dispatchEvent(event);
            await Promise.resolve();
            await Promise.resolve();

            const url = globalThis.apiRequest.mock.calls[0][0];
            expect(url).toContain('search=bob');
        });
    });
});
