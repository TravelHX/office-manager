// The Playwright configuration for this repo lives at the project root
// (`/playwright.config.js`) along with the root-level `package.json` that
// holds the `@playwright/test` dev-dependency. Run end-to-end tests from
// the repo root:
//
//   npm install         # once, to install @playwright/test at root
//   npx playwright install chromium   # once, to download the browser
//   npm run test:e2e    # requires the app stack to be running
//
// This file is kept only so editors/tooling that auto-discover
// `playwright.config.js` under `src/frontend/` do not break; it re-exports
// the canonical config so everything resolves to the same source.

module.exports = require('../../playwright.config.js');
