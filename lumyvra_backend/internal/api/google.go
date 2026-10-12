package api

import (
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/mail"
	"net/url"
	"strings"
	"time"
)

func authDestination(raw string) string {
	u, err := url.Parse(raw)
	if err != nil || !strings.HasPrefix(raw, "/") || strings.HasPrefix(u.Path, "//") || u.Host != "" || u.Scheme != "" || strings.ContainsAny(u.Path, "\\\r\n\x00") {
		return "/profile"
	}
	for _, prefix := range []string{"/login", "/api", "/_next"} {
		if u.Path == prefix || strings.HasPrefix(u.Path, prefix+"/") {
			return "/profile"
		}
	}
	return u.String()
}

func (s *Server) googleEnabled() bool {
	u, err := url.Parse(s.cfg.GoogleRedirectURL)
	if err != nil || s.cfg.GoogleClientID == "" || s.cfg.GoogleClientSecret == "" || u.Path != "/api/auth/google/callback" || u.RawQuery != "" || u.Fragment != "" || u.User != nil {
		return false
	}
	if u.Scheme != "https" && !(u.Scheme == "http" && (u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1")) {
		return false
	}
	for _, origin := range s.cfg.Origins {
		if origin == u.Scheme+"://"+u.Host {
			return true
		}
	}
	return false
}

// Start on the callback origin so the browser binding cookie also reaches the
// callback when a visitor opened the site through another hostname.
func (s *Server) googleLoginURL() string {
	if !s.googleEnabled() {
		return ""
	}
	u, _ := url.Parse(s.cfg.GoogleRedirectURL)
	u.Path = "/api/auth/google"
	u.RawPath = ""
	return u.String()
}

func googleError(w http.ResponseWriter, r *http.Request, code, next string) {
	http.Redirect(w, r, "/login?"+url.Values{"error": {code}, "next": {authDestination(next)}}.Encode(), http.StatusSeeOther)
}

func (s *Server) googleStart(w http.ResponseWriter, r *http.Request) {
	next := authDestination(r.URL.Query().Get("next"))
	if !s.googleEnabled() {
		googleError(w, r, "google_unavailable", next)
		return
	}
	if !s.allowAuth(r) {
		googleError(w, r, "rate_limited", next)
		return
	}
	state, browser, verifier := token(), token(), token()
	if _, err := s.db.Exec("DELETE FROM oauth_states WHERE expires<=?", time.Now().Unix()); err != nil {
		internal(w, err)
		return
	}
	if _, err := s.db.Exec("INSERT INTO oauth_states(state,browser,verifier,next,expires) VALUES(?,?,?,?,?)", hashToken(state), hashToken(browser), verifier, next, time.Now().Add(10*time.Minute).Unix()); err != nil {
		internal(w, err)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "lumyvra_oauth", Value: browser, Path: "/api/auth/google", HttpOnly: true, Secure: s.cfg.SecureCookies, SameSite: http.SameSiteLaxMode, MaxAge: 600})
	challenge := sha256.Sum256([]byte(verifier))
	values := url.Values{"client_id": {s.cfg.GoogleClientID}, "redirect_uri": {s.cfg.GoogleRedirectURL}, "response_type": {"code"}, "scope": {"openid email profile"}, "state": {state}, "code_challenge": {base64.RawURLEncoding.EncodeToString(challenge[:])}, "code_challenge_method": {"S256"}, "prompt": {"select_account"}}
	http.Redirect(w, r, "https://accounts.google.com/o/oauth2/v2/auth?"+values.Encode(), http.StatusSeeOther)
}

func (s *Server) googleJSON(req *http.Request, dest any) error {
	client := s.oauthHTTP
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	}
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return errors.New("google authentication request failed")
	}
	return json.NewDecoder(io.LimitReader(res.Body, 64<<10)).Decode(dest)
}

func (s *Server) googleCallback(w http.ResponseWriter, r *http.Request) {
	if !s.googleEnabled() {
		googleError(w, r, "google_unavailable", "")
		return
	}
	cookie, err := r.Cookie("lumyvra_oauth")
	if err != nil || len(cookie.Value) != 64 || len(r.URL.Query().Get("state")) != 64 {
		googleError(w, r, "google_state", "")
		return
	}
	var verifier, next string
	// Single use and bound to this browser. A mismatched browser cannot consume another browser's flow.
	err = s.db.QueryRow("DELETE FROM oauth_states WHERE state=? AND browser=? AND expires>? RETURNING verifier,next", hashToken(r.URL.Query().Get("state")), hashToken(cookie.Value), time.Now().Unix()).Scan(&verifier, &next)
	if err != nil {
		googleError(w, r, "google_state", "")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "lumyvra_oauth", Value: "", Path: "/api/auth/google", HttpOnly: true, Secure: s.cfg.SecureCookies, SameSite: http.SameSiteLaxMode, MaxAge: -1})
	if r.URL.Query().Get("error") != "" {
		googleError(w, r, "google_cancelled", next)
		return
	}
	code := r.URL.Query().Get("code")
	if code == "" || len(code) > 4096 {
		googleError(w, r, "google_failed", next)
		return
	}
	values := url.Values{"client_id": {s.cfg.GoogleClientID}, "client_secret": {s.cfg.GoogleClientSecret}, "redirect_uri": {s.cfg.GoogleRedirectURL}, "grant_type": {"authorization_code"}, "code": {code}, "code_verifier": {verifier}}
	req, _ := http.NewRequestWithContext(r.Context(), "POST", "https://oauth2.googleapis.com/token", strings.NewReader(values.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	var tokens struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
	}
	if s.googleJSON(req, &tokens) != nil || tokens.AccessToken == "" || !strings.EqualFold(tokens.TokenType, "Bearer") {
		googleError(w, r, "google_failed", next)
		return
	}
	req, _ = http.NewRequestWithContext(r.Context(), "GET", "https://openidconnect.googleapis.com/v1/userinfo", nil)
	req.Header.Set("Authorization", "Bearer "+tokens.AccessToken)
	var identity struct {
		Sub      string `json:"sub"`
		Email    string `json:"email"`
		Verified bool   `json:"email_verified"`
		Name     string `json:"name"`
	}
	if s.googleJSON(req, &identity) != nil || identity.Sub == "" || len(identity.Sub) > 255 || !identity.Verified {
		googleError(w, r, "google_failed", next)
		return
	}
	identity.Email = strings.ToLower(strings.TrimSpace(identity.Email))
	address, err := mail.ParseAddress(identity.Email)
	if err != nil || address.Address != identity.Email || len(identity.Email) > 254 {
		googleError(w, r, "google_failed", next)
		return
	}
	s.mutations.Lock()
	defer s.mutations.Unlock()
	tx, err := s.db.Begin()
	if err != nil {
		internal(w, err)
		return
	}
	defer tx.Rollback()
	var user User
	err = tx.QueryRow("SELECT u.id,u.email,u.name,u.created_at FROM oauth_identities i JOIN users u ON u.id=i.user_id WHERE i.provider='google' AND i.subject=?", identity.Sub).Scan(&user.ID, &user.Email, &user.Name, &user.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		var count int
		if err = tx.QueryRow("SELECT count(*) FROM users WHERE email=?", identity.Email).Scan(&count); err != nil {
			internal(w, err)
			return
		}
		// Email accounts are not email-verified yet. Never implicitly link a matching address.
		if count > 0 {
			googleError(w, r, "google_email_exists", next)
			return
		}
		name := strings.TrimSpace(identity.Name)
		if !clean(name, 20) {
			name = "音乐人"
		}
		user = User{ID: "user-" + token()[:24], Email: identity.Email, Name: name, CreatedAt: now()}
		if _, err = tx.Exec("INSERT INTO users(id,email,name,password,created_at) VALUES(?,?,?,?,?)", user.ID, user.Email, user.Name, "!google-only", user.CreatedAt); err != nil {
			internal(w, err)
			return
		}
		if _, err = tx.Exec("INSERT INTO oauth_identities(provider,subject,user_id) VALUES('google',?,?)", identity.Sub, user.ID); err != nil {
			internal(w, err)
			return
		}
	} else if err != nil {
		internal(w, err)
		return
	}
	if err = tx.Commit(); err != nil {
		internal(w, err)
		return
	}
	// Google sign-in remembers this browser using the existing 30-day local
	// session. Provider access tokens are not stored in the browser.
	if err = s.session(w, r, user, true); err != nil {
		internal(w, err)
		return
	}
	http.Redirect(w, r, authDestination(next), http.StatusSeeOther)
}
