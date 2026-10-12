package api

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type inferenceHealth struct {
	Status            string   `json:"status"`
	Available         bool     `json:"available"`
	ProducerAvailable bool     `json:"producerAvailable"`
	Model             string   `json:"model"`
	Issues            []string `json:"issues"`
	MaxSeconds        int      `json:"maxSeconds"`
	QualityVerified   bool     `json:"qualityVerified"`
}
type inferenceResult struct {
	ID        string `json:"id"`
	Status    string `json:"status"`
	Stage     string `json:"stage"`
	ErrorCode string `json:"errorCode"`
	Plan      struct {
		Caption string `json:"caption"`
	} `json:"plan"`
	Result struct {
		Kind   string `json:"kind"`
		Lyrics string `json:"lyrics"`
		Model  string `json:"model"`
		Seed   *int64 `json:"seed"`
		Audio  struct {
			Duration   float64 `json:"duration"`
			SampleRate int     `json:"sampleRate"`
			Channels   int     `json:"channels"`
			Bytes      int64   `json:"bytes"`
			SHA256     string  `json:"sha256"`
		} `json:"audio"`
	} `json:"result"`
}

func (s *Server) inference(ctx context.Context, method, path string, input, output any) (int, error) {
	if s.cfg.InferenceKey == "" {
		return 0, errors.New("private inference key not configured")
	}
	var payload []byte
	var err error
	if input != nil {
		payload, err = json.Marshal(input)
		if err != nil {
			return 0, err
		}
	}
	r, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(s.cfg.InferenceURL, "/")+path, bytes.NewReader(payload))
	if err != nil {
		return 0, err
	}
	r.Header.Set("Authorization", "Bearer "+s.cfg.InferenceKey)
	r.Header.Set("Content-Type", "application/json")
	response, err := s.inferenceHTTP.Do(r)
	if err != nil {
		return 0, errors.New("inference connection failed")
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return response.StatusCode, nil
	}
	if output != nil {
		err = json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(output)
	}
	return response.StatusCode, err
}

func (s *Server) engineHealth(ctx context.Context) (inferenceHealth, error) {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	var result inferenceHealth
	status, err := s.inference(ctx, "GET", "/health", nil, &result)
	if err == nil && status != 200 {
		err = errors.New("inference unavailable")
	}
	return result, err
}
func (s *Server) generationConfig(w http.ResponseWriter, r *http.Request) {
	health := inferenceHealth{Status: "offline", MaxSeconds: 240}
	if s.cfg.GenerationMode != "demo" {
		if result, err := s.engineHealth(r.Context()); err == nil {
			health = result
		}
	} else {
		health.Status = "demo"
	}
	jsonResponse(w, 200, map[string]any{"generationMode": s.cfg.GenerationMode, "musicEngine": health,
		"paymentsEnabled": false, "googleLoginEnabled": s.googleEnabled(), "googleLoginURL": s.googleLoginURL(), "genres": genres, "moods": moods})
}

// The single worker follows a durable remote task. Requests never hold the mutation mutex.
func (s *Server) advanceInference(ctx context.Context) error {
	s.mutations.Lock()
	var id string
	err := s.db.QueryRow(`SELECT id FROM jobs WHERE status IN ('queued','running','cancelling') AND json_extract(data,'$.provider')='local'
		ORDER BY CASE WHEN status IN ('running','cancelling') THEN 0 ELSE 1 END,rowid LIMIT 1`).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		s.mutations.Unlock()
		return nil
	}
	if err != nil {
		s.mutations.Unlock()
		return err
	}
	job, err := getJob(s.db, id)
	if err != nil {
		s.mutations.Unlock()
		return err
	}
	if job.Status == "queued" {
		job.Status, job.Stage, job.StartedAt, job.UpdatedAt = "running", "submitting", now(), now()
		err = saveJob(s.db, job)
	}
	s.mutations.Unlock()
	if err != nil {
		return err
	}
	if job.Input == nil {
		return s.failInference(id, "ENGINE_INTERRUPTED")
	}
	var remote inferenceResult
	status, err := s.inference(ctx, "GET", "/v1/jobs/"+id, nil, &remote)
	if err != nil || status == 0 || status >= 500 {
		return s.noteInferenceDisconnect(id)
	}
	if job.Status == "cancelling" {
		if status == 404 {
			return s.setInferenceCancelled(id)
		}
		status, err = s.inference(ctx, "POST", "/v1/jobs/"+id+"/cancel", nil, &remote)
		if err != nil || status != 200 {
			return s.noteInferenceDisconnect(id)
		}
		if remote.Status == "cancelled" || remote.Status == "succeeded" || remote.Status == "failed" {
			return s.setInferenceCancelled(id)
		}
		return nil
	}
	if status == 404 && !job.Submitted {
		request := map[string]any{"id": id, "prompt": job.Input.Prompt, "style_prompt": job.Input.StylePrompt,
			"mode": job.Input.Mode, "genre": job.Input.Genre, "mood": job.Input.Mood, "seconds": job.Input.Seconds,
			"instrumental": job.Input.Genre == "纯音乐"}
		status, err = s.inference(ctx, "POST", "/v1/jobs", request, &remote)
		if err != nil {
			return s.noteInferenceDisconnect(id)
		}
		if status < 200 || status >= 300 {
			return s.failInference(id, "INPUT_OR_ENGINE_UNAVAILABLE")
		}
		s.mutations.Lock()
		current, e := getJob(s.db, id)
		if e == nil {
			current.Submitted = true
			current.UpdatedAt = now()
			e = saveJob(s.db, current)
		}
		s.mutations.Unlock()
		if e != nil {
			return e
		}
	} else if status == 404 {
		return s.failInference(id, "ENGINE_INTERRUPTED")
	} else if status != 200 {
		return s.failInference(id, "ENGINE_UNAVAILABLE")
	}
	if remote.ID != id {
		return s.failInference(id, "OUTPUT_INVALID")
	}
	switch remote.Status {
	case "succeeded":
		return s.completeInference(ctx, job, remote)
	case "failed":
		return s.failInference(id, remote.ErrorCode)
	case "cancelled":
		return s.setInferenceCancelled(id)
	case "queued", "running", "cancelling":
		s.mutations.Lock()
		defer s.mutations.Unlock()
		current, err := getJob(s.db, id)
		if err != nil {
			return err
		}
		if current.Status != "running" {
			return nil
		}
		current.Stage, current.UpdatedAt = remote.Stage, now()
		current.Error, current.ErrorCode = "", ""
		return saveJob(s.db, current)
	default:
		return s.failInference(id, "OUTPUT_INVALID")
	}
}

func (s *Server) noteInferenceDisconnect(id string) error {
	s.mutations.Lock()
	defer s.mutations.Unlock()
	j, err := getJob(s.db, id)
	if err != nil {
		return err
	}
	if j.Status != "running" && j.Status != "cancelling" {
		return nil
	}
	started, _ := time.Parse(time.RFC3339Nano, j.StartedAt)
	if !started.IsZero() && time.Since(started) > 2*time.Hour {
		j.Status, j.ErrorCode, j.Error = "failed", "ENGINE_UNAVAILABLE", "无法恢复跟踪推理任务，请检查服务后重新提交；旧作品仍保留。"
	} else {
		j.Stage = "reconnecting"
	}
	j.UpdatedAt = now()
	return saveJob(s.db, j)
}
func (s *Server) failInference(id, code string) error {
	s.mutations.Lock()
	defer s.mutations.Unlock()
	j, err := getJob(s.db, id)
	if err != nil {
		return err
	}
	if j.Status != "running" && j.Status != "cancelling" {
		return nil
	}
	if j.Status == "cancelling" {
		j.Status = "cancelled"
	} else {
		j.Status = "failed"
	}
	j.ErrorCode, j.Error, j.UpdatedAt = safeInferenceCode(code), inferenceFailureMessage(safeInferenceCode(code)), now()
	return saveJob(s.db, j)
}
func inferenceFailureMessage(code string) string {
	message := "音乐引擎暂时不可用，请检查推理服务后重新提交。"
	switch code {
	case "ENGINE_CRASHED":
		message = "本地音乐进程异常退出，生成已停止。请重新提交；若反复发生，请检查运行环境。"
	case "ENGINE_FAILED", "MODEL_INIT_FAILED", "QUANTIZATION_UNAVAILABLE":
		message = "本地音乐推理失败，生成已停止。请检查音乐模型的运行环境。"
	case "COMPOSITION_FAILED":
		message = "旋律与编曲规划失败，未继续生成音频。请检查本地音乐规划模型。"
	case "OUT_OF_MEMORY":
		message = "本机显存或内存不足，生成已停止。请关闭占用资源的程序，或缩短时长后重试。"
	case "GLM_UNAVAILABLE":
		message = "歌词助手请求失败，请检查 GLM 服务配置或额度。"
	case "PLAN_INVALID":
		message = "歌词与制作方案校验未通过，尚未生成音频。请调整输入后重试。"
	case "MODEL_MISSING":
		message = "本地音乐模型或运行环境尚未准备好，尚未生成音频。"
	case "CUDA_UNAVAILABLE":
		message = "本地显卡推理不可用，请检查 CUDA 运行环境。"
	case "ENGINE_TIMEOUT":
		message = "音乐生成超时，任务已停止。没有自动重新生成。"
	case "ENGINE_INTERRUPTED":
		message = "推理服务中断，任务已停止。请重新提交。"
	case "OUTPUT_INVALID":
		message = "生成的音频未通过校验，未保存为可用版本。"
	}
	return message + " 草稿和旧版本仍保留。（" + code + "）"
}
func safeInferenceCode(code string) string {
	for _, allowed := range []string{"COMPOSITION_FAILED", "ENGINE_CRASHED", "ENGINE_FAILED", "OUT_OF_MEMORY", "MODEL_MISSING", "PLAN_INVALID", "GLM_UNAVAILABLE", "ENGINE_INTERRUPTED", "ENGINE_TIMEOUT", "CUDA_UNAVAILABLE", "MODEL_INIT_FAILED", "QUANTIZATION_UNAVAILABLE", "OUTPUT_INVALID", "INPUT_OR_ENGINE_UNAVAILABLE"} {
		if code == allowed {
			return code
		}
	}
	return "ENGINE_UNAVAILABLE"
}
func (s *Server) setInferenceCancelled(id string) error {
	s.mutations.Lock()
	defer s.mutations.Unlock()
	j, err := getJob(s.db, id)
	if err != nil {
		return err
	}
	if j.Status != "running" && j.Status != "cancelling" {
		return nil
	}
	j.Status, j.Stage, j.UpdatedAt = "cancelled", "cancelled", now()
	return saveJob(s.db, j)
}

func (s *Server) completeInference(ctx context.Context, job Job, remote inferenceResult) error {
	version := SongVersion{ID: "version-" + strings.TrimPrefix(job.ID, "job-"), WorkID: job.WorkID, OwnerID: job.OwnerID,
		JobID: job.ID, Input: *job.Input, Lyrics: remote.Result.Lyrics, Caption: remote.Plan.Caption,
		Kind: remote.Result.Kind, Model: remote.Result.Model, Seed: remote.Result.Seed, CreatedAt: now(), ReviewStatus: "unreviewed"}
	if version.Kind == "audio" && job.Input.Mode != "words" {
		if err := s.storeInferenceAudio(ctx, job.ID, remote, &version); err != nil {
			return s.failInference(job.ID, "OUTPUT_INVALID")
		}
	} else if version.Kind != "lyrics" || job.Input.Mode != "words" || !clean(version.Lyrics, 4096) {
		return s.failInference(job.ID, "OUTPUT_INVALID")
	}
	s.mutations.Lock()
	defer s.mutations.Unlock()
	current, err := getJob(s.db, job.ID)
	if err != nil {
		return err
	}
	if current.Status != "running" {
		return nil
	} // Cancellation wins before asset registration.
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	work, err := getWork(tx, job.WorkID)
	if err != nil {
		return err
	}
	raw, err := json.Marshal(version)
	if err != nil {
		return err
	}
	_, err = tx.Exec("INSERT OR IGNORE INTO song_versions(id,work_id,owner_id,file_name,data) VALUES(?,?,?,?,?)", version.ID, version.WorkID, version.OwnerID, version.FileName, string(raw))
	if err != nil {
		return err
	}
	// First result may become current; subsequent generations stay independent candidates.
	if work.CurrentVersion == "" && work.Revision == job.InputRevision {
		applyVersion(&work, version)
		if err = saveWork(tx, work); err != nil {
			return err
		}
	}
	current.Status, current.Stage, current.Progress, current.VersionID, current.UpdatedAt = "succeeded", "completed", 100, version.ID, now()
	current.Error, current.ErrorCode = "", ""
	if err = saveJob(tx, current); err != nil {
		return err
	}
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("register generation result: %w", err)
	}
	return nil
}
