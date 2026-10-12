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
	// Health checks and inference requests must run outside the SQLite mutation lock.
	var health inferenceHealth
	if s.cfg.GenerationMode != "demo" {
		var err error
		health, err = s.engineHealth(r.Context())
		if err != nil {
			fail(w, 503, "engine_offline", "音乐推理服务尚未连接，请先启动本地推理服务；草稿可以继续保存。")
			return
		}
	}
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
	err := s.db.QueryRow("SELECT id FROM jobs WHERE work_id=? AND status IN ('queued','running','cancelling')", work.ID).Scan(&existing)
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
	idempotency := r.Header.Get("Idempotency-Key")
	if len(idempotency) > 128 {
		fail(w, 400, "validation", "任务标识过长。")
		return
	}
	if idempotency != "" {
		err = s.db.QueryRow("SELECT id FROM jobs WHERE work_id=? AND owner_id=? AND json_extract(data,'$.idempotencyKey')=?", work.ID, work.OwnerID, idempotency).Scan(&existing)
		if err == nil {
			job, e := getJob(s.db, existing)
			if e != nil {
				internal(w, e)
				return
			}
			if job.Input != nil && (job.Input.Prompt != work.Prompt || job.Input.StylePrompt != work.StylePrompt || job.Input.Mode != work.Mode || job.Input.Genre != work.Genre || job.Input.Mood != work.Mood || job.Input.Seconds != work.Seconds) {
				fail(w, 409, "idempotency_conflict", "这个任务标识对应另一份输入，请为新创作使用新标识。")
				return
			}
			jsonResponse(w, 200, map[string]any{"job": job})
			return
		}
		if !errors.Is(err, sql.ErrNoRows) {
			internal(w, err)
			return
		}
	}
	if s.cfg.GenerationMode != "demo" {
		if work.Mode != "words" && !health.Available {
			fail(w, 503, "model_missing", "音乐运行环境或权重尚未就绪，未提交生成任务。")
			return
		}
		if work.Mode != "lyrics" && work.Genre != "纯音乐" && !health.ProducerAvailable {
			fail(w, 503, "glm_unavailable", "歌词助手未配置，请先使用手写歌词，或配置 GLM 服务。")
			return
		}
		if work.Seconds > health.MaxSeconds {
			fail(w, 400, "unsupported_duration", "当前音乐引擎尚未开放这个时长，请选择 2–4 分钟或更短片段。")
			return
		}
		var allActive int
		if err = s.db.QueryRow("SELECT count(*) FROM jobs WHERE status IN ('queued','running','cancelling') AND json_extract(data,'$.provider')='local'").Scan(&allActive); err != nil {
			internal(w, err)
			return
		}
		if allActive >= 6 {
			fail(w, 429, "queue_full", "音乐队列已满，请等待当前任务完成。")
			return
		}
	}
	var active int
	if err = s.db.QueryRow("SELECT count(*) FROM jobs WHERE owner_id=? AND status IN ('queued','running','cancelling')", work.OwnerID).Scan(&active); err != nil {
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
		fail(w, 429, "daily_limit", "每天最多提交 100 次生成，请明天再试。")
		return
	}
	input := DraftInput{Prompt: work.Prompt, StylePrompt: work.StylePrompt, Mode: work.Mode, Genre: work.Genre, Mood: work.Mood, Seconds: work.Seconds, Cover: work.Cover, SourceID: work.SourceID}
	job := Job{ID: "job-" + token()[:24], WorkID: work.ID, OwnerID: work.OwnerID, Status: "queued", Stage: "queued", Provider: s.cfg.GenerationMode, Input: &input, InputRevision: work.Revision, IdempotencyKey: idempotency, CreatedAt: now(), UpdatedAt: now()}
	tx, err := s.db.Begin()
	if err != nil {
		internal(w, err)
		return
	}
	defer tx.Rollback()
	if job.Provider == "demo" {
		work.Ready = false
		work.Lyrics = ""
		work.AudioURL = ""
	}
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
	if job.Status == "queued" || job.Status == "running" || job.Status == "cancelling" {
		wasRunning := job.Status != "queued"
		job.Status = "cancelled"
		if job.Provider != "demo" && (job.Submitted || wasRunning) {
			job.Status = "cancelling"
		}
		job.Stage = job.Status
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
			var err error
			if s.cfg.GenerationMode == "demo" {
				err = s.tickJobs()
			} else {
				err = s.advanceInference(ctx)
			}
			if err != nil {
				slog.Error("generation worker", "error", err)
			}
		}
	}
}
func (s *Server) tickJobs() error {
	s.mutations.Lock()
	defer s.mutations.Unlock()
	rows, err := s.db.Query("SELECT id FROM jobs WHERE status IN ('queued','running') AND json_extract(data,'$.provider')='demo' ORDER BY rowid LIMIT 20")
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
