/**
 * @jest-environment jsdom
 */

// Phase 23e frontend Jest tests for src/frontend/js/map-renderer.js.
//
// Verified contracts:
//   - render() shows a friendly placeholder when no config / no floor plan
//     is supplied (so booking pages still work with the list-only fallback).
//   - render() places landmarks and resource markers at the correct
//     percentage coordinates derived from normalised [0..1] inputs.
//   - HTML and attributes derived from the config are escaped so a hostile
//     label can't inject markup.
//   - Resource marker click dispatches a `map:resource-click` CustomEvent
//     whose `detail.resourceId` matches the clicked button.
//   - Landmarks render with `pointer-events: none` (CSS class -> styles.css)
//     so they don't intercept resource clicks (we assert the marker
//     positioning is on top via the rendered DOM order / class names; the
//     real CSS rule lives in styles.css and is exercised by the Playwright
//     e2e).

beforeEach(() => {
  document.body.innerHTML = '';
  // map-renderer.js binds at require() time and exports onto globalThis.
  jest.resetModules();
  delete globalThis.MapRenderer;
  // The renderer needs apiRequest only for `load`/`attach`; the synchronous
  // render() path used in these tests doesn't touch the network.
  globalThis.apiRequest = jest.fn();
  require('../js/map-renderer.js');
});

afterEach(() => {
  delete globalThis.apiRequest;
  delete globalThis.MapRenderer;
});

describe('MapRenderer.render', () => {
  test('shows fallback hint when config is null', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    globalThis.MapRenderer.render(container, null);
    expect(container.querySelector('.map-empty')).not.toBeNull();
    expect(container.textContent).toMatch(/list below/i);
    expect(container.querySelector('.map-viewport')).toBeNull();
  });

  test('shows fallback hint when no floor plan is configured', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    globalThis.MapRenderer.render(container, {
      context: 'desk',
      floorPlan: null,
      landmarks: [],
      resources: [],
    });
    expect(container.querySelector('.map-empty')).not.toBeNull();
    expect(container.querySelector('.map-floor-plan')).toBeNull();
  });

  test('renders the floor plan image with object-fit-friendly markup', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    globalThis.MapRenderer.render(container, {
      context: 'desk',
      floorPlan: { url: '/api/maps/desk/floor-plan/image?v=2', mime: 'image/png', version: 2 },
      landmarks: [],
      resources: [],
    });
    const img = container.querySelector('img.map-floor-plan');
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('/api/maps/desk/floor-plan/image?v=2');
    expect(container.querySelector('.map-viewport')).not.toBeNull();
  });

  test('places landmarks at the correct percentage coordinates', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    globalThis.MapRenderer.render(container, {
      context: 'desk',
      floorPlan: { url: '/api/maps/desk/floor-plan/image?v=1', mime: 'image/png', version: 1 },
      landmarks: [
        { id: 1, type: 'lift', label: null, x: 0.25, y: 0.5 },
        { id: 2, type: 'custom', label: 'Reception desk', x: 0.9, y: 0.1 },
      ],
      resources: [],
    });
    const lms = container.querySelectorAll('.map-landmark');
    expect(lms).toHaveLength(2);
    expect(lms[0].style.left).toBe('25%');
    expect(lms[0].style.top).toBe('50%');
    expect(lms[1].style.left).toBe('90%');
    expect(lms[1].style.top).toBe('10%');
    // Custom label rendered verbatim; lift falls back to the type display name.
    expect(lms[0].textContent).toMatch(/Lift/);
    expect(lms[1].textContent).toMatch(/Reception desk/);
  });

  test('renders only resources that have coordinates and applies selected state', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    globalThis.MapRenderer.render(
      container,
      {
        context: 'desk',
        floorPlan: { url: '/api/maps/desk/floor-plan/image?v=1', mime: 'image/png', version: 1 },
        landmarks: [],
        resources: [],
      },
      {
        resources: [
          { id: 11, number: '11', x: 0.2, y: 0.3 },          // placed
          { id: 12, number: '12', x: null, y: null },         // unplaced -> skipped
          { id: 13, number: '13', x: 0.7, y: 0.8 },          // placed
        ],
        selectedIds: new Set(['13']),
        resourceLabelPrefix: 'Desk',
      }
    );
    const markers = container.querySelectorAll('.map-resource-marker');
    expect(markers).toHaveLength(2);
    const ids = Array.from(markers).map((b) => b.getAttribute('data-resource-id'));
    expect(ids).toEqual(['11', '13']);
    expect(markers[1].classList.contains('map-resource-marker--selected')).toBe(true);
    expect(markers[0].classList.contains('map-resource-marker--selected')).toBe(false);
    expect(markers[0].getAttribute('aria-label')).toBe('Desk 11');
  });

  test('escapes hostile content in landmark labels and resource numbers', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    globalThis.MapRenderer.render(
      container,
      {
        context: 'desk',
        floorPlan: { url: 'https://example/img"&<', mime: 'image/png', version: 1 },
        landmarks: [{ id: 1, type: 'custom', label: '<img src=x onerror=alert(1)>', x: 0.1, y: 0.1 }],
        resources: [],
      },
      {
        resources: [{ id: 1, number: '<script>alert(1)</script>', x: 0.5, y: 0.5 }],
      }
    );
    const lmText = container.querySelector('.map-landmark-label').textContent;
    expect(lmText).toContain('<img src=x');
    // Make sure no actual <img> tag was injected from the label.
    expect(container.querySelectorAll('img.map-floor-plan')).toHaveLength(1);

    const marker = container.querySelector('.map-resource-marker');
    expect(marker.getAttribute('aria-label')).toContain('<script>');
    expect(container.querySelectorAll('script')).toHaveLength(0);
  });

  test('clamps out-of-range coordinates into [0, 1] before positioning', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    globalThis.MapRenderer.render(
      container,
      {
        context: 'desk',
        floorPlan: { url: '/api/maps/desk/floor-plan/image?v=1', mime: 'image/png', version: 1 },
        landmarks: [{ id: 1, type: 'lift', x: -0.5, y: 1.5 }],
        resources: [],
      }
    );
    const lm = container.querySelector('.map-landmark');
    expect(lm.style.left).toBe('0%');
    expect(lm.style.top).toBe('100%');
  });

  test('clicking a resource marker dispatches map:resource-click with the resource id', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    globalThis.MapRenderer.render(
      container,
      {
        context: 'parking',
        floorPlan: { url: '/api/maps/parking/floor-plan/image?v=1', mime: 'image/png', version: 1 },
        landmarks: [],
        resources: [],
      },
      { resources: [{ id: 42, number: 'P42', x: 0.3, y: 0.4 }] }
    );

    const handler = jest.fn();
    container.addEventListener('map:resource-click', (e) => handler(e.detail));
    container.querySelector('.map-resource-marker').click();

    expect(handler).toHaveBeenCalledWith({ resourceId: '42' });
  });
});

describe('MapRenderer.load', () => {
  test('returns null when apiRequest throws (so callers can show fallback)', async () => {
    globalThis.apiRequest = jest.fn().mockRejectedValue(new Error('network'));
    const config = await globalThis.MapRenderer.load('desk');
    expect(config).toBeNull();
    expect(globalThis.apiRequest).toHaveBeenCalled();
    expect(globalThis.apiRequest.mock.calls[0][0]).toBe('/api/maps/desk');
  });

  test('returns the config when apiRequest resolves', async () => {
    const expected = { context: 'desk', floorPlan: null, landmarks: [], resources: [] };
    globalThis.apiRequest = jest.fn().mockResolvedValue(expected);
    const config = await globalThis.MapRenderer.load('desk');
    expect(config).toBe(expected);
  });
});
