-- Graduation thesis management database, schema version 1.
PRAGMA foreign_keys = ON;
CREATE TABLE users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','teacher','student')),
 department TEXT NOT NULL DEFAULT '计算机学院',
 password_hash TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL
);
CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(id),
 expires_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_expiry ON sessions(expires_at);
CREATE TABLE topics (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 direction TEXT NOT NULL,
 description TEXT NOT NULL,
 requirements TEXT NOT NULL,
 teacher_id INTEGER NOT NULL REFERENCES users(id),
 capacity INTEGER NOT NULL CHECK(capacity BETWEEN 1 AND 10),
 created_at TEXT NOT NULL
);
CREATE TABLE selections (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 student_id INTEGER NOT NULL REFERENCES users(id),
 topic_id INTEGER NOT NULL REFERENCES topics(id),
 status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','cancelled')),
 comment TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 reviewed_at TEXT
);
CREATE UNIQUE INDEX uq_active_student ON selections(student_id)
 WHERE status IN ('pending','approved');
CREATE INDEX idx_selection_topic ON selections(topic_id,status);
CREATE TABLE submissions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 student_id INTEGER NOT NULL REFERENCES users(id),
 selection_id INTEGER NOT NULL REFERENCES selections(id),
 stage TEXT NOT NULL CHECK(stage IN ('proposal','thesis')),
 version INTEGER NOT NULL CHECK(version > 0),
 filename TEXT NOT NULL,
 file_base64 TEXT NOT NULL,
 file_size INTEGER NOT NULL CHECK(file_size BETWEEN 1 AND 5242880),
 summary TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL CHECK(status IN ('pending','approved','changes')),
 created_at TEXT NOT NULL,
 UNIQUE(student_id,stage,version)
);
CREATE TABLE reviews (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 submission_id INTEGER NOT NULL UNIQUE REFERENCES submissions(id),
 teacher_id INTEGER NOT NULL REFERENCES users(id),
 decision TEXT NOT NULL CHECK(decision IN ('approved','changes')),
 comment TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TABLE grades (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 student_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
 teacher_id INTEGER NOT NULL REFERENCES users(id),
 process_score REAL NOT NULL CHECK(process_score BETWEEN 0 AND 100),
 thesis_score REAL NOT NULL CHECK(thesis_score BETWEEN 0 AND 100),
 defense_score REAL NOT NULL CHECK(defense_score BETWEEN 0 AND 100),
 total REAL NOT NULL CHECK(total BETWEEN 0 AND 100),
 comment TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE notices (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 body TEXT NOT NULL,
 author_id INTEGER NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL
);
CREATE TABLE settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE audit_logs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id),
 action TEXT NOT NULL,
 detail TEXT NOT NULL,
 created_at TEXT NOT NULL
);
PRAGMA user_version = 1;
