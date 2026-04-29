-- Phase 27a: Key Fob Request and Allocation Subsystem - storage layer.
--
-- Adds an optional `fob_requested` flag to desk bookings and creates the
-- `fob_inventory` table that Phase 27b will populate with the default fob
-- count and per-date overrides. The matching idempotent migration step
-- in src/backend/database/migrations.js applies these to existing
-- databases (the docker-entrypoint-initdb step that runs this file only
-- fires on a freshly initialised MySQL container).

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS fob_requested TINYINT(1) NOT NULL DEFAULT 0 AFTER status;

CREATE INDEX IF NOT EXISTS idx_fob_requested_active
  ON bookings (fob_requested, status);

CREATE TABLE IF NOT EXISTS fob_inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NULL,
    count INT NOT NULL,
    updated_by INT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_fob_inventory_date (date),
    INDEX idx_fob_inventory_date (date),
    CONSTRAINT fk_fob_inventory_updated_by
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
