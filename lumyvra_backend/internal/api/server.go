package api

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type Config struct {
	Origins            []string
	SecureCookies      bool
	DemoDelay          time.Duration
	GenerationMode     string
	InferenceURL       string
	InferenceKey       string
	MediaDir           string
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string
	SMTP               SMTPConfig
}
type Server struct {
	db            *sql.DB
	cfg           Config
	mutations     sync.Mutex
	limiterMu     sync.Mutex
	limits        map[string]limit
	oauthHTTP     *http.Client
	mailSender    verificationSender
	inferenceHTTP *http.Client
}
type limit struct {
	count int
	until time.Time
}
type userKey struct{}

func New(db *sql.DB, cfg Config) *Server {
	if cfg.GenerationMode == "" {
		cfg.GenerationMode = "local"
		// Explicit short demo delays are retained for legacy demonstration tests.
		if cfg.DemoDelay > 0 {
			cfg.GenerationMode = "demo"
		}
	}
	if cfg.InferenceURL == "" {
		cfg.InferenceURL = "http://127.0.0.1:8090"
	}
	if cfg.MediaDir == "" {
		cfg.MediaDir = "media"
	}
	if cfg.DemoDelay <= 0 {
		cfg.DemoDelay = 3 * time.Second
	}
	s := &Server{db: db, cfg: cfg, limits: make(map[string]limit)}
	s.inferenceHTTP = &http.Client{Timeout: 10 * time.Second, CheckRedirect: func(r *http.Request, via []*http.Request) error { return http.ErrUseLastResponse }}
	if cfg.SMTP.valid() {
		s.mailSender = cfg.SMTP
	}
	return s
}

func token() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}
func jsonResponse(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func fail(w http.ResponseWriter, status int, code, message string) {
	jsonResponse(w, status, map[string]any{"error": map[string]string{"code": code, "message": message}})
}
func internal(w http.ResponseWriter, err error) {
	slog.Error("request failed", "error", err)
	fail(w, 500, "internal_error", "服务暂时不可用，请稍后重试。")
}
func body(w http.ResponseWriter, r *http.Request, target any) bool {
	media, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if media != "application/json" {
		fail(w, 415, "content_type", "请使用 JSON 请求。")
		return false
	}
	r.Body = http.MaxBytesReader(w, r.Body, 32<<10)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		fail(w, 400, "invalid_json", "请求内容无效或过长。")
		return false
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		fail(w, 400, "invalid_json", "请求只能包含一个 JSON 对象。")
		return false
	}
	return true
}
func currentUser(r *http.Request) *User { user, _ := r.Context().Value(userKey{}).(*User); return user }
func (s *Server) require(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if currentUser(r) == nil {
			fail(w, 401, "unauthorized", "请先登录后继续。")
			return
		}
		next(w, r)
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		if err := s.db.PingContext(r.Context()); err != nil {
			internal(w, err)
			return
		}
		jsonResponse(w, 200, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /api/config", s.generationConfig)
	mux.HandleFunc("POST /api/auth/register/code", s.sendRegistrationCode)
	mux.HandleFunc("POST /api/auth/register", s.register)
	mux.HandleFunc("POST /api/auth/login", s.login)
	mux.HandleFunc("POST /api/auth/logout", s.logout)
	mux.HandleFunc("GET /api/auth/google", s.googleStart)
	mux.HandleFunc("GET /api/auth/google/callback", s.googleCallback)
	mux.HandleFunc("GET /api/me", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, 200, map[string]any{"user": currentUser(r)})
	})
	mux.HandleFunc("PATCH /api/me", s.require(s.updateProfile))
	mux.HandleFunc("GET /api/works", s.listPublic)
	mux.HandleFunc("GET /api/inspirations", s.listPublic)
	mux.HandleFunc("GET /api/me/works", s.require(s.listMine))
	mux.HandleFunc("GET /api/works/{id}", s.detail)
	mux.HandleFunc("POST /api/works", s.require(s.createDraft))
	mux.HandleFunc("PUT /api/works/{id}/draft", s.require(s.updateDraft))
	mux.HandleFunc("PATCH /api/works/{id}", s.require(s.editMetadata))
	mux.HandleFunc("DELETE /api/works/{id}", s.require(s.deleteDraft))
	mux.HandleFunc("POST /api/works/{id}/publish", s.require(s.publish))
	mux.HandleFunc("POST /api/works/{id}/generate", s.require(s.generate))
	mux.HandleFunc("GET /api/works/{id}/job", s.require(s.latestJob))
	mux.HandleFunc("GET /api/jobs/{id}", s.require(s.jobStatus))
	mux.HandleFunc("POST /api/jobs/{id}/cancel", s.require(s.cancelJob))
	mux.HandleFunc("GET /api/works/{id}/versions", s.require(s.listVersions))
	mux.HandleFunc("POST /api/works/{id}/versions/{version}/adopt", s.require(s.adoptVersion))
	mux.HandleFunc("GET /api/audio/{id}", s.serveAudio)
	mux.HandleFunc("GET /api/me/favorites", s.require(s.listFavorites))
	mux.HandleFunc("PUT /api/me/favorites/{id}", s.require(s.favorite))
	mux.HandleFunc("DELETE /api/me/favorites/{id}", s.require(s.favorite))
	mux.HandleFunc("GET /api/catalog", func(w http.ResponseWriter, r *http.Request) { jsonResponse(w, 200, map[string]any{"works": catalog}) })
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) { fail(w, 404, "not_found", "接口不存在。") })
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				slog.Error("request panic", "detail", recovered)
				fail(w, 500, "internal_error", "服务暂时不可用。")
			}
		}()
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		// API is same-origin via Next.js. Cross-origin mutations must explicitly match deployment configuration.
		origin := r.Header.Get("Origin")
		if r.Method != "GET" && r.Method != "HEAD" {
			allowed := origin == "" && r.Header.Get("Sec-Fetch-Site") != "cross-site"
			for _, trusted := range s.cfg.Origins {
				if origin == trusted {
					allowed = true
				}
			}
			if !allowed {
				fail(w, 403, "origin_denied", "请求来源不被允许。")
				return
			}
		}
		if c, err := r.Cookie("lumyvra_session"); err == nil {
			var user User
			err = s.db.QueryRowContext(r.Context(), `SELECT u.id,u.email,u.name,u.created_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?`, hashToken(c.Value), time.Now().Unix()).Scan(&user.ID, &user.Email, &user.Name, &user.CreatedAt)
			if err == nil {
				r = r.WithContext(context.WithValue(r.Context(), userKey{}, &user))
			} else if !errors.Is(err, sql.ErrNoRows) {
				internal(w, err)
				return
			}
		}
		mux.ServeHTTP(w, r)
	})
}

func (s *Server) allowAuth(r *http.Request) bool {
	host, _, _ := net.SplitHostPort(r.RemoteAddr)
	s.limiterMu.Lock()
	defer s.limiterMu.Unlock()
	now := time.Now()
	// Bounded in-memory limits; do not trust user-controlled forwarding headers.
	for key, v := range s.limits {
		if now.After(v.until) {
			delete(s.limits, key)
		}
	}
	if len(s.limits) > 10000 {
		return false
	}
	entry := s.limits[host]
	if entry.until.IsZero() {
		entry.until = now.Add(15 * time.Minute)
	}
	entry.count++
	s.limits[host] = entry
	return entry.count <= 30
}

func clean(value string, max int) bool {
	n := len([]rune(strings.TrimSpace(value)))
	return n > 0 && n <= max
}
