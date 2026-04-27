// map-renderer.js — shared square map renderer used on the desk booking page,
// the parking page, and the admin map editor (Phase 23e).
//
// Loaded as a plain <script> (no ES modules) and exposes:
//   globalThis.MapRenderer.{ load, render, attach }
//
// Contracts:
//   - The square viewport keeps a 1:1 aspect ratio (CSS) and uses
//     object-fit: contain on the floor plan image, so markers placed in
//     normalized (0..1) coordinates align regardless of viewport size.
//   - Landmark markers MUST NOT block clicks on resource markers; they
//     are rendered with `pointer-events: none`. Resource markers are
//     interactive and dispatch a `map:resource-click` CustomEvent on the
//     viewport DOM node so callers can wire selection/booking behaviour.
//   - When no floor plan is configured for the context, render() emits a
//     friendly placeholder rather than failing — the existing list-based
//     flows are the always-on fallback.

(function () {
    'use strict';

    function apiRequest(endpoint, options) {
        const impl = globalThis.apiRequest;
        if (typeof impl !== 'function') {
            throw new Error('apiRequest is not registered; load main.js before map-renderer.js.');
        }
        return impl(endpoint, options);
    }

    /** Escape a string for safe interpolation into HTML attribute / text contexts. */
    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /** Clamp a value into [0, 1] (defensive — server enforces this too). */
    function clamp01(n) {
        const v = Number(n);
        if (!Number.isFinite(v)) return 0;
        return Math.min(1, Math.max(0, v));
    }

    /**
     * Fetch /api/maps/:context. Returns the JSON body, or null on auth /
     * server error so the caller can fall back to the list-only view.
     */
    async function load(context) {
        try {
            const data = await apiRequest(`/api/maps/${encodeURIComponent(context)}`);
            return data || null;
        } catch (_err) {
            return null;
        }
    }

    /**
     * Render the map into `container` using `config` (as returned by `load`).
     *
     * @param {HTMLElement} container       - Empty element to render into.
     * @param {Object} config                - Map config from /api/maps/:context.
     * @param {Object} [opts]
     * @param {Array}  [opts.resources]      - Override resource list (e.g. only those still available for the picked dates).
     * @param {Set}    [opts.selectedIds]    - Set of resource ids that should render as "selected".
     * @param {string} [opts.resourceLabelPrefix] - Prefix for the marker tooltip (e.g. "Desk", "Space").
     */
    function render(container, config, opts) {
        const options = opts || {};
        if (!container) return;

        if (!config) {
            container.innerHTML = `
                <div class="map-empty">
                    <p>No map configured for this view. Use the list below to make a selection.</p>
                </div>
            `;
            return;
        }

        const fp = config.floorPlan;
        const landmarks = Array.isArray(config.landmarks) ? config.landmarks : [];
        const resources = Array.isArray(options.resources)
            ? options.resources
            : (Array.isArray(config.resources) ? config.resources : []);
        const selected = options.selectedIds instanceof Set ? options.selectedIds : new Set();
        const labelPrefix = options.resourceLabelPrefix || 'Resource';

        if (!fp) {
            container.innerHTML = `
                <div class="map-empty">
                    <p>No floor plan has been uploaded yet for this area. Use the list below to make a selection.</p>
                </div>
            `;
            return;
        }

        const landmarkMarkup = landmarks.map((l) => {
            const x = clamp01(l.x) * 100;
            const y = clamp01(l.y) * 100;
            const labelText = l.label ? l.label : prettyLandmarkType(l.type);
            return `
                <div class="map-landmark" style="left: ${x}%; top: ${y}%;"
                     data-landmark-id="${escapeHtml(l.id)}"
                     data-landmark-type="${escapeHtml(l.type)}">
                    <span class="map-landmark-icon" aria-hidden="true">${escapeHtml(landmarkIcon(l.type))}</span>
                    <span class="map-landmark-label">${escapeHtml(labelText)}</span>
                </div>
            `;
        }).join('');

        const resourceMarkup = resources.map((r) => {
            const id = r.id !== undefined ? r.id : r.resourceId;
            // Skip resources that have not been placed on the map yet.
            if (id === undefined || id === null) return '';
            if (r.x === null || r.x === undefined || r.y === null || r.y === undefined) return '';
            const x = clamp01(r.x) * 100;
            const y = clamp01(r.y) * 100;
            const isSelected = selected.has(String(id));
            const labelText = r.label || `${labelPrefix} ${r.number || id}`;
            return `
                <button type="button"
                        class="map-resource-marker${isSelected ? ' map-resource-marker--selected' : ''}"
                        style="left: ${x}%; top: ${y}%;"
                        data-resource-id="${escapeHtml(id)}"
                        aria-label="${escapeHtml(labelText)}"
                        title="${escapeHtml(labelText)}">
                    <span class="map-resource-marker-label">${escapeHtml(r.number || id)}</span>
                </button>
            `;
        }).join('');

        container.innerHTML = `
            <div class="map-viewport" data-context="${escapeHtml(config.context)}">
                <img class="map-floor-plan"
                     src="${escapeHtml(fp.url)}"
                     alt="Floor plan for ${escapeHtml(config.context)} selection"
                     draggable="false">
                <div class="map-overlay">
                    ${landmarkMarkup}
                    ${resourceMarkup}
                </div>
            </div>
        `;

        // Wire resource clicks to dispatch a CustomEvent on the viewport so
        // page scripts can react without hard-coupling.
        const viewport = container.querySelector('.map-viewport');
        if (viewport) {
            container.querySelectorAll('.map-resource-marker').forEach((btn) => {
                btn.addEventListener('click', () => {
                    viewport.dispatchEvent(new CustomEvent('map:resource-click', {
                        bubbles: true,
                        detail: { resourceId: btn.getAttribute('data-resource-id') },
                    }));
                });
            });
        }
    }

    function prettyLandmarkType(type) {
        if (!type) return '';
        return String(type).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }

    function landmarkIcon(type) {
        switch (type) {
            case 'toilet': return 'WC';
            case 'lift': return '🛗';
            case 'stairs': return '🪜';
            case 'exit': return '⎋';
            case 'kitchen': return '🍴';
            case 'reception': return 'i';
            case 'meeting_room': return '🗣';
            case 'first_aid': return '+';
            default: return '•';
        }
    }

    /**
     * Convenience: load + render in one call. Returns the loaded config so
     * callers can keep a reference (e.g. for later resource overlays).
     */
    async function attach(container, context, opts) {
        const config = await load(context);
        render(container, config, opts);
        return config;
    }

    globalThis.MapRenderer = {
        load,
        render,
        attach,
        _internals: { escapeHtml, clamp01, prettyLandmarkType, landmarkIcon },
    };
})();
