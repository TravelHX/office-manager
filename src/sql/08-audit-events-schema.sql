-- Audit Event Schema (Phase 21a)
-- This file creates the append-only audit_events table used by
-- src/backend/services/AuditService.js. No application code emits rows yet
-- (Phase 21d will wire emission into each mutating flow); the table exists
-- so the schema, model, repository, and service can be delivered first.
--
-- Deployment note: MySQL only runs files under /docker-entrypoint-initdb.d
-- on first container initialisation. Existing databases will not pick up
-- this file automatically; apply it manually (e.g.
--     mysql ... < src/sql/08-audit-events-schema.sql
-- ) or recreate the test container.
--
-- Note: Database is automatically selected by Docker MySQL based on
-- MYSQL_DATABASE env var.

CREATE TABLE IF NOT EXISTS audit_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- actor_id is the users.id at the time of the action. Deliberately NOT
    -- a foreign key: audit history must survive deletion of the user.
    actor_id INT NULL,
    -- Snapshot of the actor's email at the time of the action, so deleted
    -- users remain identifiable in historical records.
    actor_email VARCHAR(255) NULL,
    -- Stable machine-readable code, e.g. DESK_BOOKING_CREATED. See
    -- docs/audit-events.md for the full catalogue.
    action_type VARCHAR(64) NOT NULL,
    target_type VARCHAR(64) NULL,
    target_id INT NULL,
    -- Short human-readable description safe to show in admin UI.
    summary VARCHAR(512) NULL,
    -- Structured context. MUST NOT contain secrets (no passwords, no full
    -- tokens, no password hashes).
    payload JSON NULL,
    ip_address VARCHAR(45) NULL,
    INDEX idx_occurred_at (occurred_at),
    INDEX idx_actor_id (actor_id),
    INDEX idx_action_type (action_type),
    INDEX idx_actor_occurred (actor_id, occurred_at),
    INDEX idx_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
