/**
 * SQLite Database Schema for Offline Storage
 * Mirrors backend data models with offline-specific enhancements
 */

export const CREATE_USERS_TABLE = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('operator', 'supervisor')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    last_login TEXT
  );
`;

export const CREATE_WEIGHT_REGISTRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS weight_registrations (
    id TEXT PRIMARY KEY,
    weight REAL NOT NULL CHECK (weight > 0 AND weight <= 50),
    cut_type TEXT NOT NULL CHECK (cut_type IN ('jamón', 'chuleta')),
    supplier TEXT NOT NULL,
    photo_url TEXT,
    local_photo_path TEXT,
    ocr_confidence REAL CHECK (ocr_confidence >= 0 AND ocr_confidence <= 1),
    sync_status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (sync_status IN ('synced', 'pending', 'failed')),
    registered_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (registered_by) REFERENCES users(id)
  );
`;

export const CREATE_SYNC_QUEUE_TABLE = `
  CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY,
    operation_type TEXT NOT NULL CHECK (operation_type IN ('create_registration', 'upload_photo', 'update_user')),
    entity_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 1,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL
  );
`;

export const CREATE_USERS_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);
`;

export const CREATE_REGISTRATIONS_SYNC_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_registrations_sync ON weight_registrations(sync_status);
`;

export const CREATE_REGISTRATIONS_DATE_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_registrations_date ON weight_registrations(created_at);
`;

export const CREATE_SYNC_QUEUE_PRIORITY_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_sync_queue_priority ON sync_queue(priority, created_at);
`;

export const DATABASE_VERSION = 1;

export const ALL_CREATE_STATEMENTS = [
  CREATE_USERS_TABLE,
  CREATE_WEIGHT_REGISTRATIONS_TABLE,
  CREATE_SYNC_QUEUE_TABLE,
  CREATE_USERS_INDEX,
  CREATE_REGISTRATIONS_SYNC_INDEX,
  CREATE_REGISTRATIONS_DATE_INDEX,
  CREATE_SYNC_QUEUE_PRIORITY_INDEX,
];