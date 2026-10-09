package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"strconv"
	"strings"
)

func (s *Server) accessible(r *http.Request, id string) (Work, error) {
	for _, item := range catalog {
		if item.ID == id {
			return item, nil
		}
	}
	work, err := getWork(s.db, id)
	if err == nil && work.Status != "published" && (currentUser(r) == nil || currentUser(r).ID != work.OwnerID) {
		return Work{}, sql.ErrNoRows
	}
	return work, err
}
func (s *Server) publicView(work Work, user *User) Work {
	// Authenticated owners may edit their parameters; other users only get prompts by opt-in.
	if user == nil || user.ID != work.OwnerID {
		if !work.AllowRemix {
			work.Prompt = ""
			work.SourceID = ""
			work.SourceTitle = ""
		}
	}
	if work.OwnerID != "catalog" {
		_ = s.db.QueryRow("SELECT name FROM users WHERE id=?", work.OwnerID).Scan(&work.Artist)
	}
	return work
}
func (s *Server) detail(w http.ResponseWriter, r *http.Request) {
	work, err := s.accessible(r, r.PathValue("id"))
	if errors.Is(err, sql.ErrNoRows) {
		fail(w, 404, "not_found", "作品不存在或尚未公开。")
		return
	}
	if err != nil {
		internal(w, err)
		return
	}
	jsonResponse(w, 200, map[string]any{"work": s.publicView(work, currentUser(r))})
}
func (s *Server) list(w http.ResponseWriter, r *http.Request, mine bool) {
	query := `SELECT data FROM works WHERE status='published'`
	args := []any{}
	if mine {
		query = "SELECT data FROM works WHERE owner_id=?"
		args = append(args, currentUser(r).ID)
	}
	query += " ORDER BY updated_at DESC"
	rows, err := s.db.QueryContext(r.Context(), query, args...)
	if err != nil {
		internal(w, err)
		return
	}
	works := []Work{}
	for rows.Next() {
		var raw string
		var work Work
		if err = rows.Scan(&raw); err != nil {
			break
		}
		if err = json.Unmarshal([]byte(raw), &work); err != nil {
			break
		}
		works = append(works, work)
	}
	rowErr := rows.Err()
	rows.Close()
	if err != nil {
		internal(w, err)
		return
	}
	if rowErr != nil {
		internal(w, rowErr)
		return
	}
	filtered := []Work{}
	needle := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
	for _, work := range works {
		if r.URL.Path == "/api/inspirations" && !work.AllowRemix {
			continue
		}
		if status := r.URL.Query().Get("status"); mine && status != "" && work.Status != status {
			continue
		}
		work = s.publicView(work, currentUser(r))
		if needle != "" && !strings.Contains(strings.ToLower(work.Title+work.Artist+work.Genre+work.Mood), needle) {
			continue
		}
		filtered = append(filtered, work)
	}
	// Bounded responses, with explicit paging for large libraries.
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}
	if offset > len(filtered) {
		offset = len(filtered)
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 100
	}
	if limit > 200 {
		limit = 200
	}
	end := min(offset+limit, len(filtered))
	jsonResponse(w, 200, map[string]any{"works": filtered[offset:end], "total": len(filtered), "offset": offset, "limit": limit})
}
func (s *Server) listMine(w http.ResponseWriter, r *http.Request)   { s.list(w, r, true) }
func (s *Server) listPublic(w http.ResponseWriter, r *http.Request) { s.list(w, r, false) }

func validDraft(input DraftInput) bool {
	return clean(input.Prompt, 500) && slices.Contains([]string{"text", "lyrics", "words"}, input.Mode) && slices.Contains(genres, input.Genre) && slices.Contains(moods, input.Mood) && slices.Contains(covers, input.Cover) && input.Seconds >= 30 && input.Seconds <= 300
}
func (s *Server) activeJob(id string) bool {
	var count int
	err := s.db.QueryRow("SELECT count(*) FROM jobs WHERE work_id=? AND status IN ('queued','running')", id).Scan(&count)
	return err != nil || count > 0
}
func (s *Server) owner(w http.ResponseWriter, r *http.Request) (Work, bool) {
	work, err := getWork(s.db, r.PathValue("id"))
	if errors.Is(err, sql.ErrNoRows) || (err == nil && work.OwnerID != currentUser(r).ID) {
		fail(w, 404, "not_found", "未找到你的作品。")
		return work, false
	}
	if err != nil {
		internal(w, err)
		return work, false
	}
	return work, true
}
func (s *Server) createDraft(w http.ResponseWriter, r *http.Request) { s.draft(w, r, false) }
func (s *Server) updateDraft(w http.ResponseWriter, r *http.Request) { s.draft(w, r, true) }
func (s *Server) draft(w http.ResponseWriter, r *http.Request, editing bool) {
	var input DraftInput
	if !body(w, r, &input) {
		return
	}
	if !validDraft(input) {
		fail(w, 400, "validation", "请检查灵感、风格、情绪、封面及 30–300 秒时长。")
		return
	}
	input.Prompt = strings.TrimSpace(input.Prompt)
	s.mutations.Lock()
	defer s.mutations.Unlock()
	user := currentUser(r)
	work := Work{ID: "work-" + token()[:24], OwnerID: user.ID, Artist: user.Name, Title: string([]rune(input.Prompt)[:min(18, len([]rune(input.Prompt)))]), Status: "draft", CreatedAt: now(), GenerationMode: "demo"}
	if editing {
		var ok bool
		work, ok = s.owner(w, r)
		if !ok {
			return
		}
		if work.Status != "draft" || s.activeJob(work.ID) {
			fail(w, 409, "work_locked", "已发布或正在生成的作品暂不可修改。")
			return
		}
	} else {
		var count int
		if err := s.db.QueryRow("SELECT count(*) FROM works WHERE owner_id=?", user.ID).Scan(&count); err != nil {
			internal(w, err)
			return
		}
		if count >= 1000 {
			fail(w, 409, "work_limit", "作品数量已达上限，请整理草稿后再创建。")
			return
		}
	}
	// Source titles are server-derived, never accepted as an attribution claim.
	sourceID, sourceTitle := "", ""
	if input.SourceID != "" {
		if editing && input.SourceID == work.SourceID {
			sourceID, sourceTitle = work.SourceID, work.SourceTitle
		} else {
			source, err := s.accessible(r, input.SourceID)
			if err != nil || source.Status != "published" || !source.AllowRemix {
				fail(w, 400, "remix_unavailable", "来源作品不存在或未开放做同款。")
				return
			}
			sourceID, sourceTitle = source.ID, source.Title
		}
	}
	unchanged := work.Prompt == input.Prompt && work.Mode == input.Mode && work.Genre == input.Genre && work.Mood == input.Mood && work.Seconds == input.Seconds && work.Cover == input.Cover
	if !unchanged || input.Regenerate {
		work.Ready = false
		work.Lyrics = ""
		work.AudioURL = ""
	}
	work.Prompt = input.Prompt
	work.Mode = input.Mode
	work.Genre = input.Genre
	work.Mood = input.Mood
	work.Seconds = input.Seconds
	work.Cover = input.Cover
	work.SourceID = sourceID
	work.SourceTitle = sourceTitle
	work.UpdatedAt = now()
	if err := saveWork(s.db, work); err != nil {
		internal(w, err)
		return
	}
	status := 201
	if editing {
		status = 200
	}
	jsonResponse(w, status, map[string]any{"work": work})
}

type metadata struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	AllowRemix  bool   `json:"allowRemix"`
}

func (s *Server) editMetadata(w http.ResponseWriter, r *http.Request) { s.metadata(w, r, false) }
func (s *Server) publish(w http.ResponseWriter, r *http.Request)      { s.metadata(w, r, true) }
func (s *Server) metadata(w http.ResponseWriter, r *http.Request, publish bool) {
	var input metadata
	if !body(w, r, &input) {
		return
	}
	if !clean(input.Title, 40) || len([]rune(input.Description)) > 240 {
		fail(w, 400, "validation", "作品名称需要 1–40 个字，介绍不超过 240 个字。")
		return
	}
	s.mutations.Lock()
	defer s.mutations.Unlock()
	work, ok := s.owner(w, r)
	if !ok {
		return
	}
	if publish && work.Status == "published" {
		jsonResponse(w, 200, map[string]any{"work": work})
		return
	}
	if work.Status != "draft" || s.activeJob(work.ID) {
		fail(w, 409, "work_locked", "作品已发布或正在生成，请稍后再试。")
		return
	}
	if publish && !work.Ready {
		fail(w, 409, "not_ready", "请先完成生成，再发布作品。")
		return
	}
	work.Title = strings.TrimSpace(input.Title)
	work.Description = strings.TrimSpace(input.Description)
	work.UpdatedAt = now()
	if publish {
		work.Status = "published"
		work.PublishedAt = now()
		work.AllowRemix = input.AllowRemix
	}
	if err := saveWork(s.db, work); err != nil {
		internal(w, err)
		return
	}
	jsonResponse(w, 200, map[string]any{"work": work})
}
func (s *Server) deleteDraft(w http.ResponseWriter, r *http.Request) {
	s.mutations.Lock()
	defer s.mutations.Unlock()
	work, ok := s.owner(w, r)
	if !ok {
		return
	}
	if work.Status != "draft" || s.activeJob(work.ID) {
		fail(w, 409, "work_locked", "仅可删除未在生成的草稿。")
		return
	}
	if _, err := s.db.Exec("DELETE FROM works WHERE id=?", work.ID); err != nil {
		internal(w, err)
		return
	}
	jsonResponse(w, 200, map[string]bool{"ok": true})
}
func (s *Server) favorite(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	user := currentUser(r)
	if r.Method == "DELETE" {
		if _, err := s.db.Exec("DELETE FROM favorites WHERE user_id=? AND work_id=?", user.ID, id); err != nil {
			internal(w, err)
			return
		}
	} else {
		work, err := s.accessible(r, id)
		if err != nil || work.Status != "published" {
			fail(w, 404, "not_found", "只能收藏已发布作品。")
			return
		}
		if _, err = s.db.Exec("INSERT OR IGNORE INTO favorites(user_id,work_id,created_at) VALUES(?,?,?)", user.ID, id, now()); err != nil {
			internal(w, err)
			return
		}
	}
	jsonResponse(w, 200, map[string]bool{"ok": true})
}
func (s *Server) listFavorites(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query("SELECT work_id FROM favorites WHERE user_id=? ORDER BY created_at DESC", currentUser(r).ID)
	if err != nil {
		internal(w, err)
		return
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
		internal(w, err)
		return
	}
	if rowErr != nil {
		internal(w, rowErr)
		return
	}
	works := []Work{}
	for _, id := range ids {
		work, err := s.accessible(r, id)
		if err == nil && work.Status == "published" {
			works = append(works, s.publicView(work, currentUser(r)))
		}
	}
	jsonResponse(w, 200, map[string]any{"works": works})
}
