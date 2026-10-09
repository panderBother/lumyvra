package api

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"net/http"
	"time"
)

func (s *Server) generate(w http.ResponseWriter, r *http.Request) {
	s.mutations.Lock()
	defer s.mutations.Unlock()
	work, ok := s.owner(w, r)
	if !ok {
		return
	}
	if work.Status != "draft" {
		fail(w, 409, "published", "已发布作品不能重新生成，请创作一个新版本。")
		return
	}
	var existing string
	err := s.db.QueryRow("SELECT id FROM jobs WHERE work_id=? AND status IN ('queued','running')", work.ID).Scan(&existing)
	if err == nil {
		job, e := getJob(s.db, existing)
		if e != nil {
			internal(w, e)
			return
		}
		jsonResponse(w, 200, map[string]any{"job": job})
		return
	}
	if !errors.Is(err, sql.ErrNoRows) {
		internal(w, err)
		return
	}
	var active int
	if err = s.db.QueryRow("SELECT count(*) FROM jobs WHERE owner_id=? AND status IN ('queued','running')", work.OwnerID).Scan(&active); err != nil {
		internal(w, err)
		return
	}
	if active >= 3 {
		fail(w, 429, "generation_limit", "最多同时生成 3 份作品，请等待当前任务完成。")
		return
	}
	var recent int
	if err = s.db.QueryRow("SELECT count(*) FROM jobs WHERE owner_id=? AND json_extract(data,'$.createdAt')>?", work.OwnerID, time.Now().Add(-24*time.Hour).UTC().Format(time.RFC3339Nano)).Scan(&recent); err != nil {
		internal(w, err)
		return
	}
	if recent >= 100 {
		fail(w, 429, "daily_limit", "演示生成每天最多 100 次，请明天再试。")
		return
	}
	job := Job{ID: "job-" + token()[:24], WorkID: work.ID, OwnerID: work.OwnerID, Status: "queued", Provider: "demo", CreatedAt: now(), UpdatedAt: now()}
	tx, err := s.db.Begin()
	if err != nil {
		internal(w, err)
		return
	}
	defer tx.Rollback()
	work.Ready = false
	work.Lyrics = ""
	work.AudioURL = ""
	work.UpdatedAt = now()
	if err = saveWork(tx, work); err == nil {
		err = saveJob(tx, job)
	}
	if err == nil {
		err = tx.Commit()
	}
	if err != nil {
		internal(w, err)
		return
	}
	jsonResponse(w, 202, map[string]any{"job": job})
}
func (s *Server) jobStatus(w http.ResponseWriter, r *http.Request) {
	job, err := getJob(s.db, r.PathValue("id"))
	if errors.Is(err, sql.ErrNoRows) || (err == nil && job.OwnerID != currentUser(r).ID) {
		fail(w, 404, "not_found", "生成任务不存在。")
		return
	}
	if err != nil {
		internal(w, err)
		return
	}
	jsonResponse(w, 200, map[string]any{"job": job})
}
func (s *Server) latestJob(w http.ResponseWriter, r *http.Request) {
	work, ok := s.owner(w, r)
	if !ok {
		return
	}
	var id string
	err := s.db.QueryRow("SELECT id FROM jobs WHERE work_id=? ORDER BY json_extract(data,'$.createdAt') DESC LIMIT 1", work.ID).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		jsonResponse(w, 200, map[string]any{"job": nil})
		return
	}
	if err != nil {
		internal(w, err)
		return
	}
	job, err := getJob(s.db, id)
	if err != nil {
		internal(w, err)
		return
	}
	jsonResponse(w, 200, map[string]any{"job": job})
}
func (s *Server) cancelJob(w http.ResponseWriter, r *http.Request) {
	s.mutations.Lock()
	defer s.mutations.Unlock()
	job, err := getJob(s.db, r.PathValue("id"))
	if errors.Is(err, sql.ErrNoRows) || (err == nil && job.OwnerID != currentUser(r).ID) {
		fail(w, 404, "not_found", "生成任务不存在。")
		return
	}
	if err != nil {
		internal(w, err)
		return
	}
	if job.Status == "queued" || job.Status == "running" {
		job.Status = "cancelled"
		job.UpdatedAt = now()
		if err = saveJob(s.db, job); err != nil {
			internal(w, err)
			return
		}
	}
	jsonResponse(w, 200, map[string]any{"job": job})
}

// Demo provider deliberately produces sample lyrics, never fake music or audio URLs.
// Jobs are stored in SQLite and survive browser navigation and process restarts.
func (s *Server) RunWorker(ctx context.Context) {
	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := s.tickJobs(); err != nil {
				slog.Error("generation worker", "error", err)
			}
		}
	}
}
func (s *Server) tickJobs() error {
	s.mutations.Lock()
	defer s.mutations.Unlock()
	rows, err := s.db.Query("SELECT id FROM jobs WHERE status IN ('queued','running') ORDER BY rowid LIMIT 20")
	if err != nil {
		return err
	}
	ids := []string{}
	for rows.Next() {
		var id string
		if err = rows.Scan(&id); err != nil {
			break
		}
		ids = append(ids, id)
	}
	rowErr := rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	if rowErr != nil {
		return rowErr
	}
	for _, id := range ids {
		job, err := getJob(s.db, id)
		if err != nil {
			return err
		}
		created, err := time.Parse(time.RFC3339Nano, job.CreatedAt)
		if err != nil {
			return err
		}
		job.Status = "running"
		job.Progress = min(95, int(time.Since(created).Seconds()/s.cfg.DemoDelay.Seconds()*95))
		job.UpdatedAt = now()
		if time.Since(created) < s.cfg.DemoDelay {
			if err = saveJob(s.db, job); err != nil {
				return err
			}
			continue
		}
		tx, err := s.db.Begin()
		if err != nil {
			return err
		}
		work, err := getWork(tx, job.WorkID)
		if err == nil {
			work.Ready = true
			work.GenerationMode = "demo"
			work.UpdatedAt = now()
			work.Lyrics = "[演示歌词 · 非 AI 生成]\n把今天写成一封信\n交给经过窗边的风\n在还没说完的故事里\n留下一段属于你的声音"
			if work.Mode == "lyrics" {
				work.Lyrics = work.Prompt
			}
			job.Status = "succeeded"
			job.Progress = 100
			err = saveWork(tx, work)
		}
		if err == nil {
			err = saveJob(tx, job)
		}
		if err == nil {
			err = tx.Commit()
		} else {
			_ = tx.Rollback()
		}
		if err != nil {
			return err
		}
	}
	return nil
}
