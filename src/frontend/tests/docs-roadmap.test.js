/**
 * Contract tests for product documentation (Phase 23 roadmap in spec and todo).
 * Runs in frontend Jest (no database); satisfies documentation change coverage.
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../../..');
const todoPath = path.join(repoRoot, 'docs', 'todo.md');
const specPath = path.join(repoRoot, 'docs', 'spec.md');

describe('Product documentation (Phase 23)', () => {
  test('docs/todo.md contains Phase 23 and overtime removal task', () => {
    const text = fs.readFileSync(todoPath, 'utf8');
    expect(text).toContain('## Phase 23');
    expect(text).toMatch(/23\.\d+/);
    expect(text).toContain('Remove overtime');
  });

  test('docs/spec.md contains sections 16--19 for roadmap items', () => {
    const text = fs.readFileSync(specPath, 'utf8');
    expect(text).toContain('### 16. Removal of Overtime Feature');
    expect(text).toContain('### 17. Floor Plan Map for Desk and Parking Selection');
    expect(text).toContain('### 18. Undo Desk Booking Cancellation');
    expect(text).toContain('### 19. Consistent Booking Action Buttons and Selection Mode');
  });
});
