-- Floor Plan Maps Schema (Phase 23d)
-- Adds tables for the per-context floor plan image, the per-context list of
-- orientation landmarks, and the per-resource normalized map coordinates.
-- "Context" is one of: 'desk' or 'parking'. Each context has at most one
-- active floor plan image at a time (replaces on upload).
--
-- Coordinates are stored as DECIMAL(8,6) in [0, 1] inclusive, representing
-- a fraction of the image width / height. This keeps markers aligned when
-- the square map viewport is resized in the browser.
--
-- Deployment note: MySQL only runs files under /docker-entrypoint-initdb.d
-- on first container initialisation. Existing databases will not pick up
-- this file automatically; the migration in src/backend/database/migrations.js
-- creates these tables idempotently on every server start.

CREATE TABLE IF NOT EXISTS floor_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    context VARCHAR(32) NOT NULL UNIQUE,
    image_path VARCHAR(512) NOT NULL,
    image_mime VARCHAR(64) NOT NULL,
    image_version INT NOT NULL DEFAULT 1,
    uploaded_by INT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_floor_plans_context (context)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS map_landmarks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    context VARCHAR(32) NOT NULL,
    type VARCHAR(32) NOT NULL,
    label VARCHAR(128) NULL,
    x_norm DECIMAL(8,6) NOT NULL,
    y_norm DECIMAL(8,6) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_landmarks_context (context)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS desk_map_coordinates (
    desk_id INT PRIMARY KEY,
    x_norm DECIMAL(8,6) NOT NULL,
    y_norm DECIMAL(8,6) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_desk_map_coordinates_desk
        FOREIGN KEY (desk_id) REFERENCES desks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS parking_space_map_coordinates (
    parking_space_id INT PRIMARY KEY,
    x_norm DECIMAL(8,6) NOT NULL,
    y_norm DECIMAL(8,6) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_parking_space_map_coordinates_space
        FOREIGN KEY (parking_space_id) REFERENCES parking_spaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
