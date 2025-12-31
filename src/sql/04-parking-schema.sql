-- Parking Tracking Schema
-- This file creates the schema for parking spaces and reservations
-- Note: Database is automatically selected by Docker MySQL based on MYSQL_DATABASE env var

-- Parking spaces table
CREATE TABLE IF NOT EXISTS parking_spaces (
    id INT AUTO_INCREMENT PRIMARY KEY,
    space_number VARCHAR(50) NOT NULL UNIQUE,
    location VARCHAR(255),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_space_number (space_number),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Parking reservations table
CREATE TABLE IF NOT EXISTS parking_reservations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    parking_space_id INT NOT NULL,
    reservation_date DATE NOT NULL,
    time_period ENUM('morning', 'afternoon', 'full_day') NOT NULL DEFAULT 'full_day',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    cancelled_at TIMESTAMP NULL,
    cancelled_by INT NULL,
    cancellation_reason TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parking_space_id) REFERENCES parking_spaces(id) ON DELETE CASCADE,
    FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_parking_space_id (parking_space_id),
    INDEX idx_reservation_date (reservation_date),
    INDEX idx_time_period (time_period),
    INDEX idx_status (status),
    INDEX idx_date_period (reservation_date, time_period)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

