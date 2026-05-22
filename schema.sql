-- D1 (SQLite) schema for MEUFInanças
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS config (
  pk TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS trips (
  carId TEXT NOT NULL,
  date TEXT NOT NULL,               -- YYYY-MM-DD
  went TEXT NOT NULL,               -- JSON array
  returned TEXT NOT NULL,           -- JSON array
  parkingAvulso INTEGER NOT NULL DEFAULT 0, -- 0/1
  createdAt TEXT,
  updatedAt TEXT,
  PRIMARY KEY (carId, date)
);

CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(date);

CREATE TABLE IF NOT EXISTS weeks (
  weekId TEXT PRIMARY KEY,          -- YYYY-MM-DD (Monday)
  data TEXT,
  createdAt TEXT,
  updatedAt TEXT
);
