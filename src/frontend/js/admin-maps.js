// admin-maps.js — Phase 23e admin map editor.
//
// Wires the Maps tab in admin.html. Lets an admin:
//   1. Pick a context (desk or parking).
//   2. Upload a PNG/JPEG floor plan via raw POST (no multipart needed).
//   3. Click on the map to place / move landmarks (after picking a type).
//   4. Click on the map to place / move desks or parking spaces (after
//      picking a resource from the side list).
//   5. Delete landmarks via a per-marker delete button (rendered for the
//      currently-selected landmark).
//
// All clicks compute normalized coordinates against the map viewport's
// bounding rect — same coordinate space the renderer uses to position
// markers, so what you click is what you save.
//
// The Maps tab is admin-only; admin.js reveals it with the same gate as
// User Management / Audit.

(function () {
    'use strict';

    function apiRequest(endpoint, options) {
        const impl = globalThis.apiRequest;
        if (typeof impl !== 'function') {
            throw new Error('apiRequest is not registered; load main.js before admin-maps.js.');
        }
        return impl(endpoint, options);
    }

    const CONTEXTS = ['desk', 'parking'];
    const LANDMARK_TYPES = [
        'toilet', 'lift', 'stairs', 'exit', 'kitchen',
        'reception', 'meeting_room', 'first_aid', 'custom',
    ];

    // Editor state — recreated each time the tab is opened so a context
    // switch starts from a clean slate.
    const state = {
        context: 'desk',
        config: null,
        // 'landmark' or 'resource' — what the next viewport click does.
        mode: 'landmark',
        landmarkType: 'lift',
        landmarkLabel: '',
        // Currently-selected resource id when in resource mode.
        activeResourceId: null,
        // All desks / parking spaces (active only) for the current context,
        // populated from /api/admin/desks or /parking-spaces.
        resources: [],
    };

    function setStatus(msg, kind) {
        const el = document.getElementById('map-editor-status');
        if (!el) return;
        el.textContent = msg || '';
        el.className = 'map-editor-status' + (kind ? ' ' + kind : '');
    }

    function viewportRectFor(target) {
        const viewport = target.closest('.map-viewport') || target.querySelector?.('.map-viewport');
        if (!viewport) return null;
        return { viewport, rect: viewport.getBoundingClientRect() };
    }

    /**
     * Translate a click event on the map viewport to normalized [0, 1]
     * coordinates. Click happens at viewport coords (even if the image
     * itself is letterboxed inside via object-fit: contain), so callers
     * may store coordinates that fall outside the visible image — that's
     * acceptable; admins should click within the image.
     */
    function normalisedClick(event, viewport) {
        const rect = viewport.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
    }

    async function fetchResourcesForContext(context) {
        const endpoint = context === 'desk' ? '/api/admin/desks' : '/api/admin/parking-spaces';
        const rows = await apiRequest(endpoint);
        return rows
            .filter((r) => r.isActive === true || r.isActive === 1)
            .map((r) => ({
                id: r.id,
                number: context === 'desk' ? r.deskNumber : r.spaceNumber,
                location: r.location,
            }));
    }

    function mergeResourcesWithCoordinates(resources, coords) {
        const byId = new Map();
        coords.forEach((c) => byId.set(String(c.resourceId), { x: c.x, y: c.y }));
        return resources.map((r) => {
            const placed = byId.get(String(r.id));
            return {
                ...r,
                x: placed ? placed.x : null,
                y: placed ? placed.y : null,
            };
        });
    }

    async function loadEditor() {
        try {
            setStatus('Loading map...', '');
            const [config, resources] = await Promise.all([
                apiRequest(`/api/admin/maps/${state.context}`),
                fetchResourcesForContext(state.context),
            ]);
            state.config = config;
            // Merge each resource with its coordinate (or null if unplaced)
            // so the editor list can show placement status.
            state.resources = mergeResourcesWithCoordinates(resources, config.resources || []);
            // Default the active resource to the first unplaced one (so the
            // admin can place every resource in one pass without manual
            // selection between clicks).
            const firstUnplaced = state.resources.find((r) => r.x === null);
            state.activeResourceId = firstUnplaced ? String(firstUnplaced.id) : null;
            renderEditor();
            setStatus('Ready.');
        } catch (error) {
            setStatus('Failed to load map: ' + (error.message || 'unknown error'), 'error');
        }
    }

    function renderEditor() {
        const container = document.getElementById('map-editor-canvas');
        if (!container) return;

        const renderer = globalThis.MapRenderer;
        const editorResources = state.resources.map((r) => ({
            id: r.id,
            number: r.number,
            x: r.x,
            y: r.y,
        }));

        renderer.render(
            container,
            { ...state.config, resources: editorResources },
            { resourceLabelPrefix: state.context === 'desk' ? 'Desk' : 'Space' }
        );

        // Add the editor-mode crosshair class to the viewport.
        const viewport = container.querySelector('.map-viewport');
        if (viewport) {
            container.querySelector('.map-viewport').classList.add('map-editor-canvas');
            viewport.addEventListener('click', onViewportClick);
        }

        renderResourceList();
    }

    function renderResourceList() {
        const list = document.getElementById('map-editor-resource-list');
        if (!list) return;
        if (state.mode !== 'resource') {
            list.innerHTML = '<small class="text-muted">Switch to "Resource" mode to place desks / parking spaces on the map.</small>';
            return;
        }
        if (state.resources.length === 0) {
            list.innerHTML = '<small class="text-muted">No active resources for this context.</small>';
            return;
        }
        list.innerHTML = state.resources.map((r) => {
            const isActive = String(r.id) === String(state.activeResourceId);
            const isPlaced = r.x !== null;
            const cls = [
                isPlaced ? 'is-placed' : '',
                isActive ? 'is-active' : '',
            ].filter(Boolean).join(' ');
            return `<button type="button" class="${cls}" data-resource-id="${r.id}">${r.number}${isPlaced ? ' ✓' : ''}</button>`;
        }).join('');
        list.querySelectorAll('button').forEach((b) => {
            b.addEventListener('click', () => {
                state.activeResourceId = b.getAttribute('data-resource-id');
                renderResourceList();
            });
        });
    }

    async function onViewportClick(event) {
        // Only respond to clicks on the viewport background — clicks on
        // existing resource markers should still re-place that marker, so
        // we let those propagate normally; the marker handler dispatches a
        // map:resource-click which we listen for separately below.
        const target = event.target;
        if (target && (target.closest('.map-resource-marker') || target.closest('.map-landmark'))) {
            return;
        }
        const viewport = event.currentTarget;
        const { x, y } = normalisedClick(event, viewport);

        if (state.mode === 'landmark') {
            await placeLandmark(x, y);
        } else if (state.mode === 'resource') {
            await placeActiveResource(x, y);
        }
    }

    async function placeLandmark(x, y) {
        const labelInput = document.getElementById('map-landmark-label');
        const label = (labelInput?.value || '').trim();
        try {
            const created = await apiRequest(`/api/admin/maps/${state.context}/landmarks`, {
                method: 'POST',
                body: { type: state.landmarkType, label: label || undefined, x, y },
            });
            state.config.landmarks = (state.config.landmarks || []).concat([created]);
            renderEditor();
            setStatus(`Placed ${created.type} landmark.`);
        } catch (error) {
            setStatus('Could not place landmark: ' + (error.message || 'unknown error'), 'error');
        }
    }

    async function placeActiveResource(x, y) {
        if (!state.activeResourceId) {
            setStatus('Select a desk / parking space from the list first.', 'error');
            return;
        }
        try {
            const persisted = await apiRequest(
                `/api/admin/maps/${state.context}/resources/${encodeURIComponent(state.activeResourceId)}/coordinates`,
                { method: 'PUT', body: { x, y } }
            );
            // Update local state so the UI reflects the new placement
            // without a round-trip to /api/admin/maps/:context.
            const idx = state.resources.findIndex((r) => String(r.id) === String(persisted.resourceId));
            if (idx >= 0) {
                state.resources[idx] = { ...state.resources[idx], x: persisted.x, y: persisted.y };
            }
            // Auto-advance to the next unplaced resource so a placement
            // session feels fluid.
            const next = state.resources.find((r) => r.x === null);
            state.activeResourceId = next ? String(next.id) : null;
            renderEditor();
            setStatus(`Placed ${state.context === 'desk' ? 'desk' : 'space'} ${persisted.resourceId}.`);
        } catch (error) {
            setStatus('Could not place resource: ' + (error.message || 'unknown error'), 'error');
        }
    }

    async function handleUploadSubmit(event) {
        event.preventDefault();
        const fileInput = document.getElementById('map-upload-file');
        const file = fileInput?.files?.[0];
        if (!file) {
            setStatus('Choose a PNG, JPEG, or SVG file first.', 'error');
            return;
        }
        // Phase 32: SVG joins PNG/JPEG. Server-side sanitisation strips
        // active content from SVG before it lands on disk, so callers do
        // not need to scrub anything client-side beyond the type check.
        if (!/^image\/(png|jpeg|svg\+xml)$/.test(file.type)) {
            setStatus('Only PNG, JPEG, or SVG files are allowed.', 'error');
            return;
        }
        try {
            setStatus('Uploading…');
            const buffer = await file.arrayBuffer();
            // The shared apiRequest wrapper auto-stringifies object bodies,
            // so we go directly via fetch for binary content.
            const token = (typeof globalThis.getAuthToken === 'function') ? globalThis.getAuthToken() : null;
            const response = await fetch(`/api/admin/maps/${state.context}/floor-plan`, {
                method: 'POST',
                headers: {
                    'Content-Type': file.type,
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                },
                body: buffer,
            });
            if (!response.ok) {
                let msg = 'Upload failed';
                try {
                    const body = await response.json();
                    if (body?.error?.message) msg = body.error.message;
                } catch (_) { /* empty body */ }
                throw new Error(msg);
            }
            const persisted = await response.json();
            state.config.floorPlan = {
                url: `/api/maps/${state.context}/floor-plan/image?v=${persisted.imageVersion}`,
                mime: persisted.imageMime,
                version: persisted.imageVersion,
                uploadedAt: persisted.uploadedAt,
            };
            renderEditor();
            setStatus(`Uploaded floor plan v${persisted.imageVersion}.`);
            if (fileInput) fileInput.value = '';
        } catch (error) {
            setStatus('Upload failed: ' + (error.message || 'unknown error'), 'error');
        }
    }

    function setupControls() {
        const contextSelect = document.getElementById('map-context');
        if (contextSelect) {
            // Populate (idempotent — only add once).
            if (contextSelect.options.length === 0) {
                CONTEXTS.forEach((c) => {
                    const opt = document.createElement('option');
                    opt.value = c;
                    opt.textContent = c === 'desk' ? 'Desk map' : 'Parking map';
                    contextSelect.appendChild(opt);
                });
            }
            contextSelect.value = state.context;
            contextSelect.addEventListener('change', () => {
                state.context = contextSelect.value;
                loadEditor();
            });
        }

        const modeSelect = document.getElementById('map-mode');
        if (modeSelect) {
            modeSelect.addEventListener('change', () => {
                state.mode = modeSelect.value;
                renderResourceList();
                setStatus(state.mode === 'landmark'
                    ? 'Click on the map to place a landmark of the selected type.'
                    : 'Pick a resource from the list, then click on the map to place it.');
            });
        }

        const typeSelect = document.getElementById('map-landmark-type');
        if (typeSelect) {
            if (typeSelect.options.length === 0) {
                LANDMARK_TYPES.forEach((t) => {
                    const opt = document.createElement('option');
                    opt.value = t;
                    opt.textContent = t.replace(/_/g, ' ');
                    typeSelect.appendChild(opt);
                });
            }
            typeSelect.value = state.landmarkType;
            typeSelect.addEventListener('change', () => {
                state.landmarkType = typeSelect.value;
            });
        }

        const uploadForm = document.getElementById('map-upload-form');
        if (uploadForm) {
            uploadForm.addEventListener('submit', handleUploadSubmit);
        }

        const deleteFloorPlanBtn = document.getElementById('map-delete-floor-plan');
        if (deleteFloorPlanBtn) {
            deleteFloorPlanBtn.addEventListener('click', async () => {
                if (!window.confirm(`Delete the ${state.context} floor plan?`)) return;
                try {
                    await apiRequest(`/api/admin/maps/${state.context}/floor-plan`, { method: 'DELETE' });
                    state.config.floorPlan = null;
                    renderEditor();
                    setStatus('Floor plan deleted.');
                } catch (error) {
                    setStatus('Delete failed: ' + (error.message || 'unknown error'), 'error');
                }
            });
        }
    }

    function init() {
        setupControls();
        loadEditor();
    }

    /**
     * Wire-up entry point exposed to admin.js. Idempotent — admin.js calls
     * it once when the Maps sidebar button becomes visible.
     */
    function initMapsTabControls() {
        if (initMapsTabControls._wired) return;
        initMapsTabControls._wired = true;
        init();
    }

    globalThis.initMapsTabControls = initMapsTabControls;
})();
