package api

import (
	"crypto/pbkdf2"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"
)

const passwordIterations = 600000

func passwordHash(password string) string {
	salt := token()[:32]
	derived, err := pbkdf2.Key(sha256.New, password, []byte(salt), passwordIterations, 32)
	if err != nil {
		panic(err)
	}
	return salt + ":" + hex.EncodeToString(derived)
}
func passwordMatches(hash, password string) bool {
	parts := strings.Split(hash, ":")
	if len(parts) != 2 {
		return false
	}
	key, err := pbkdf2.Key(sha256.New, password, []byte(parts[0]), passwordIterations, 32)
	if err != nil {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(hex.EncodeToString(key)), []byte(parts[1])) == 1
}
func hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Remember bool   `json:"remember"`
	Code     string `json:"code,omitempty"`
}

func (s *Server) credentials(w http.ResponseWriter, r *http.Request) (credentials, bool) {
	var c credentials
	if !s.allowAuth(r) {
		fail(w, 429, "rate_limited", "尝试次数过多，请 15 分钟后重试。")
		return c, false
	}
	if !body(w, r, &c) {
		return c, false
	}
	c.Email = strings.ToLower(strings.TrimSpace(c.Email))
	if !validEmail(c.Email) || len(c.Password) < 8 || len(c.Password) > 128 {
		fail(w, 400, "validation", "请输入有效邮箱和 8–128 字节的密码。")
		return c, false
	}
	return c, true
}
func (s *Server) session(w http.ResponseWriter, r *http.Request, user User, remember bool) error {
	raw := token()
	lifetime := 24 * time.Hour
	if remember {
		lifetime = 30 * 24 * time.Hour
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if c, err := r.Cookie("lumyvra_session"); err == nil {
		if _, err = tx.Exec("DELETE FROM sessions WHERE token=?", hashToken(c.Value)); err != nil {
			return err
		}
	}
	if _, err = tx.Exec("DELETE FROM sessions WHERE expires<=?", time.Now().Unix()); err != nil {
		return err
	}
	if _, err = tx.Exec("INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)", hashToken(raw), user.ID, time.Now().Add(lifetime).Unix()); err != nil {
		return err
	}
	if err = tx.Commit(); err != nil {
		return err
	}
	cookie := &http.Cookie{Name: "lumyvra_session", Value: raw, Path: "/", HttpOnly: true, Secure: s.cfg.SecureCookies, SameSite: http.SameSiteLaxMode}
	if remember {
		cookie.MaxAge = int(lifetime.Seconds())
		cookie.Expires = time.Now().Add(lifetime)
	}
	http.SetCookie(w, cookie)
	return nil
}
func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	c, ok := s.credentials(w, r)
	if !ok {
		return
	}
	if !validCode(c.Code) {
		fail(w, 400, "verification_required", "请输入邮箱收到的 6 位验证码。")
		return
	}
	u := User{ID: "user-" + token()[:24], Email: c.Email, Name: "音乐人", CreatedAt: now()}
	s.mutations.Lock()
	defer s.mutations.Unlock()
	var exists int
	err := s.db.QueryRow("SELECT count(*) FROM users WHERE email=?", c.Email).Scan(&exists)
	if err != nil {
		internal(w, err)
		return
	}
	if exists > 0 {
		fail(w, 409, "email_exists", "这个邮箱已经注册，请登录。")
		return
	}
	tx, err := s.db.Begin()
	if err != nil {
		internal(w, err)
		return
	}
	defer tx.Rollback()
	if !consumeRegistrationCode(w, tx, c.Email, c.Code) {
		return
	}
	if _, err = tx.Exec("INSERT INTO users(id,email,name,password,created_at) VALUES(?,?,?,?,?)", u.ID, u.Email, u.Name, passwordHash(c.Password), u.CreatedAt); err != nil {
		internal(w, err)
		return
	}
	if err = tx.Commit(); err != nil {
		internal(w, err)
		return
	}
	if err = s.session(w, r, u, c.Remember); err != nil {
		internal(w, err)
		return
	}
	jsonResponse(w, 201, map[string]any{"user": u})
}
func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	c, ok := s.credentials(w, r)
	if !ok {
		return
	}
	var u User
	var hash string
	err := s.db.QueryRow("SELECT id,email,name,password,created_at FROM users WHERE email=?", c.Email).Scan(&u.ID, &u.Email, &u.Name, &hash, &u.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		passwordMatches(strings.Repeat("0", 32)+":"+strings.Repeat("0", 64), c.Password)
		fail(w, 401, "invalid_credentials", "邮箱或密码不正确。")
		return
	}
	if err != nil {
		internal(w, err)
		return
	}
	if !passwordMatches(hash, c.Password) {
		fail(w, 401, "invalid_credentials", "邮箱或密码不正确。")
		return
	}
	if err = s.session(w, r, u, c.Remember); err != nil {
		internal(w, err)
		return
	}
	jsonResponse(w, 200, map[string]any{"user": u})
}
func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie("lumyvra_session"); err == nil {
		if _, err = s.db.Exec("DELETE FROM sessions WHERE token=?", hashToken(c.Value)); err != nil {
			internal(w, err)
			return
		}
	}
	http.SetCookie(w, &http.Cookie{Name: "lumyvra_session", Value: "", Path: "/", MaxAge: -1, HttpOnly: true, Secure: s.cfg.SecureCookies, SameSite: http.SameSiteLaxMode})
	jsonResponse(w, 200, map[string]bool{"ok": true})
}
func (s *Server) updateProfile(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Name string `json:"name"`
	}
	if !body(w, r, &input) {
		return
	}
	if !clean(input.Name, 20) {
		fail(w, 400, "validation", "昵称需要 1–20 个字。")
		return
	}
	u := *currentUser(r)
	u.Name = strings.TrimSpace(input.Name)
	if _, err := s.db.Exec("UPDATE users SET name=? WHERE id=?", u.Name, u.ID); err != nil {
		internal(w, err)
		return
	}
	jsonResponse(w, 200, map[string]any{"user": u})
}
