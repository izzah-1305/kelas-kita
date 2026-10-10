import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const NOW = `strftime('%Y-%m-%dT%H:%M:%fZ','now')`;

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('teacher','student')),
  created_at    TEXT NOT NULL DEFAULT (${NOW})
);

CREATE TABLE IF NOT EXISTS classes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  code        TEXT NOT NULL UNIQUE,
  teacher_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (${NOW})
);

CREATE TABLE IF NOT EXISTS class_members (
  class_id  INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL DEFAULT (${NOW}),
  PRIMARY KEY (class_id, user_id)
);

CREATE TABLE IF NOT EXISTS posts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id   INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  author_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('announcement','material')),
  title      TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  link_url   TEXT,
  created_at TEXT NOT NULL DEFAULT (${NOW})
);

CREATE TABLE IF NOT EXISTS assignments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id    INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  due_date    TEXT,
  max_score   INTEGER NOT NULL DEFAULT 100,
  created_at  TEXT NOT NULL DEFAULT (${NOW})
);

CREATE TABLE IF NOT EXISTS submissions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL DEFAULT '',
  link_url      TEXT,
  score         INTEGER,
  feedback      TEXT,
  submitted_at  TEXT NOT NULL DEFAULT (${NOW}),
  graded_at     TEXT,
  UNIQUE (assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS threads (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id   INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  author_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (${NOW})
);

CREATE TABLE IF NOT EXISTS replies (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id  INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  author_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (${NOW})
);

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id   INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (${NOW})
);

CREATE INDEX IF NOT EXISTS idx_members_user    ON class_members(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_class     ON posts(class_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_assign_class    ON assignments(class_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_threads_class   ON threads(class_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_replies_thread  ON replies(thread_id, id);
CREATE INDEX IF NOT EXISTS idx_messages_class  ON messages(class_id, id DESC);
`);

export default db;
