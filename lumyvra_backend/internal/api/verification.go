package api

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"database/sql"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"net/mail"
	"strconv"
	"strings"
	"time"
)

type verificationSender interface {
	SendCode(context.Context, string, string) error
}

func validEmail(email string) bool {
	address, err := mail.ParseAddress(email)
	return err == nil && address.Address == email && len(email) <= 254 && !strings.ContainsAny(email, "\r\n")
}

func validCode(code string) bool {
	if len(code) != 6 {
		return false
	}
	for _, c := range code {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

func (s *Server) sendRegistrationCode(w http.ResponseWriter, r *http.Request) {
	if !s.allowAuth(r) {
		fail(w, 429, "rate_limited", "尝试次数过多，请 15 分钟后重试。")
		return
	}
	var input struct {
		Email string `json:"email"`
	}
	if !body(w, r, &input) {
		return
	}
	email := strings.ToLower(strings.TrimSpace(input.Email))
	if !validEmail(email) {
		fail(w, 400, "validation", "请输入有效邮箱。")
		return
	}
	if s.mailSender == nil {
		fail(w, 503, "mail_unavailable", "邮箱验证服务暂未配置，请稍后再试。")
		return
	}
	number, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		internal(w, err)
		return
	}
	code, salt := fmt.Sprintf("%06d", number.Int64()), token()
	digest := hashToken(email + ":" + salt + ":" + code)
	// Reserve before network I/O. Concurrent requests and server restarts cannot bypass email limits.
	retry, exists, err := s.reserveRegistrationCode(email, salt, digest)
	if err != nil {
		internal(w, err)
		return
	}
	if exists {
		fail(w, 409, "email_exists", "这个邮箱已经注册，请登录。")
		return
	}
	if retry > 0 {
		w.Header().Set("Retry-After", strconv.FormatInt(retry, 10))
		fail(w, 429, "code_rate_limited", "验证码发送过于频繁，请稍后重试（每分钟一次，每小时最多 5 次）。")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	if err = s.mailSender.SendCode(ctx, email, code); err != nil {
		// Do not log provider responses: they can contain recipient addresses or credentials.
		fail(w, 502, "mail_delivery_failed", "验证码发送失败，请稍后重试。")
		return
	}
	if _, err = s.db.Exec("UPDATE registration_codes SET ready=1,expires=? WHERE email=? AND code_hash=?", time.Now().Add(10*time.Minute).Unix(), email, digest); err != nil {
		internal(w, err)
		return
	}
	jsonResponse(w, 200, map[string]any{"ok": true, "expiresIn": 600, "retryAfter": 60})
}

func (s *Server) reserveRegistrationCode(email, salt, digest string) (retry int64, exists bool, err error) {
	s.mutations.Lock()
	defer s.mutations.Unlock()
	tx, err := s.db.Begin()
	if err != nil {
		return 0, false, err
	}
	defer tx.Rollback()
	var count int
	if err = tx.QueryRow("SELECT count(*) FROM users WHERE email=?", email).Scan(&count); err != nil {
		return 0, false, err
	}
	if count > 0 {
		return 0, true, nil
	}
	now := time.Now().Unix()
	// Retain each row at least until its hourly quota has expired.
	if _, err = tx.Exec("DELETE FROM registration_codes WHERE window_start<=? AND expires<=?", now-3600, now); err != nil {
		return 0, false, err
	}
	var sent, window int64
	err = tx.QueryRow("SELECT sent_at,window_start,send_count FROM registration_codes WHERE email=?", email).Scan(&sent, &window, &count)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return 0, false, err
	}
	if sent+60 > now {
		return sent + 60 - now, false, nil
	}
	if window+3600 > now && count >= 5 {
		return window + 3600 - now, false, nil
	}
	if window+3600 <= now {
		window, count = now, 0
	}
	_, err = tx.Exec(`INSERT INTO registration_codes(email,salt,code_hash,expires,sent_at,attempts,ready,window_start,send_count) VALUES(?,?,?,?,?,0,0,?,?)
ON CONFLICT(email) DO UPDATE SET salt=excluded.salt,code_hash=excluded.code_hash,expires=excluded.expires,sent_at=excluded.sent_at,attempts=0,ready=0,window_start=excluded.window_start,send_count=excluded.send_count`, email, salt, digest, now+600, now, window, count+1)
	if err != nil {
		return 0, false, err
	}
	return 0, false, tx.Commit()
}

// Successful consumption and account creation share a transaction. Wrong guesses commit their attempt count.
func consumeRegistrationCode(w http.ResponseWriter, tx *sql.Tx, email, code string) bool {
	var salt, digest string
	var expires int64
	var attempts, ready int
	err := tx.QueryRow("SELECT salt,code_hash,expires,attempts,ready FROM registration_codes WHERE email=?", email).Scan(&salt, &digest, &expires, &attempts, &ready)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		internal(w, err)
		return false
	}
	if errors.Is(err, sql.ErrNoRows) || ready != 1 || expires <= time.Now().Unix() || attempts >= 5 {
		fail(w, 400, "invalid_code", "验证码无效、已过期或尝试次数过多，请重新获取。")
		return false
	}
	if subtle.ConstantTimeCompare([]byte(digest), []byte(hashToken(email+":"+salt+":"+code))) != 1 {
		if _, err = tx.Exec("UPDATE registration_codes SET attempts=attempts+1 WHERE email=?", email); err != nil {
			internal(w, err)
			return false
		}
		if err = tx.Commit(); err != nil {
			internal(w, err)
			return false
		}
		fail(w, 400, "invalid_code", "验证码不正确，请检查邮箱中的最新验证码。")
		return false
	}
	if _, err = tx.Exec("DELETE FROM registration_codes WHERE email=?", email); err != nil {
		internal(w, err)
		return false
	}
	return true
}
