package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	_ "modernc.org/sqlite"
	"os"
	"path/filepath"
)

const schema = `
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires);
CREATE TABLE IF NOT EXISTS works (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS works_owner ON works(owner_id, updated_at);
CREATE INDEX IF NOT EXISTS works_status ON works(status, updated_at);
CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE, owner_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL, data TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_active_work ON jobs(work_id) WHERE status IN ('queued', 'running');
CREATE TABLE IF NOT EXISTS favorites (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, work_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(user_id,work_id));
CREATE TABLE IF NOT EXISTS oauth_identities (provider TEXT NOT NULL, subject TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(provider,subject));
CREATE TABLE IF NOT EXISTS oauth_states (state TEXT PRIMARY KEY, browser TEXT NOT NULL, verifier TEXT NOT NULL, next TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS registration_codes (email TEXT PRIMARY KEY, salt TEXT NOT NULL, code_hash TEXT NOT NULL, expires INTEGER NOT NULL, sent_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, ready INTEGER NOT NULL DEFAULT 0, window_start INTEGER NOT NULL, send_count INTEGER NOT NULL);
PRAGMA user_version = 3;
`

func OpenDatabase(path string) (*sql.DB, error) {
	if path != ":memory:" {
		if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
			return nil, err
		}
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	// Single connection makes PRAGMA settings and SQLite writes deterministic.
	db.SetMaxOpenConns(1)
	for _, statement := range []string{"PRAGMA foreign_keys=ON", "PRAGMA journal_mode=WAL", "PRAGMA busy_timeout=5000", schema} {
		if _, err = db.Exec(statement); err != nil {
			db.Close()
			return nil, fmt.Errorf("database initialization: %w", err)
		}
	}
	return db, nil
}

type querier interface {
	Exec(string, ...any) (sql.Result, error)
	QueryRow(string, ...any) *sql.Row
}

func getWork(q querier, id string) (Work, error) {
	var raw string
	var w Work
	err := q.QueryRow("SELECT data FROM works WHERE id=?", id).Scan(&raw)
	if err == nil {
		err = json.Unmarshal([]byte(raw), &w)
	}
	return w, err
}

func saveWork(q querier, w Work) error {
	raw, err := json.Marshal(w)
	if err != nil {
		return err
	}
	_, err = q.Exec(`INSERT INTO works(id,owner_id,status,updated_at,data) VALUES(?,?,?,?,?)
 ON CONFLICT(id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at,data=excluded.data`, w.ID, w.OwnerID, w.Status, w.UpdatedAt, string(raw))
	return err
}

func saveJob(q querier, j Job) error {
	raw, err := json.Marshal(j)
	if err != nil {
		return err
	}
	_, err = q.Exec(`INSERT INTO jobs(id,work_id,owner_id,status,data) VALUES(?,?,?,?,?)
 ON CONFLICT(id) DO UPDATE SET status=excluded.status,data=excluded.data`, j.ID, j.WorkID, j.OwnerID, j.Status, string(raw))
	return err
}

func getJob(q querier, id string) (Job, error) {
	var raw, owner string
	var j Job
	err := q.QueryRow("SELECT data,owner_id FROM jobs WHERE id=?", id).Scan(&raw, &owner)
	if err == nil {
		err = json.Unmarshal([]byte(raw), &j)
		j.OwnerID = owner
	}
	return j, err
}
