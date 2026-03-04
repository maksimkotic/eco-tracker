PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

CREATE TABLE checkins_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  habitId INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE ON UPDATE CASCADE,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  value FLOAT NOT NULL DEFAULT 1,
  date DATETIME NOT NULL,
  notes TEXT,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL
);

INSERT INTO checkins_new (id, habitId, userId, value, date, notes, createdAt, updatedAt)
SELECT id, habitId, userId, value, date, notes, createdAt, updatedAt
FROM checkins;

DROP TABLE checkins;
ALTER TABLE checkins_new RENAME TO checkins;

COMMIT;
PRAGMA foreign_keys = ON;
