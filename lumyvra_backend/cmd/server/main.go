package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/panderBother/lumyvra/lumyvra_backend/internal/api"
)

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
func main() {
	if err := godotenv.Load(".env"); err != nil && !errors.Is(err, os.ErrNotExist) {
		// Parser errors may contain secrets from the file; do not log their text.
		slog.Error("cannot load .env; check file permissions and KEY=value syntax")
		os.Exit(1)
	}
	db, err := api.OpenDatabase(env("DATABASE_PATH", "data/lumyvra.db"))
	if err != nil {
		slog.Error("open database", "error", err)
		os.Exit(1)
	}
	defer db.Close()
	app := api.New(db, api.Config{Origins: strings.Split(env("APP_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"), ","), SecureCookies: os.Getenv("COOKIE_SECURE") == "true",
		GoogleClientID: os.Getenv("GOOGLE_CLIENT_ID"), GoogleClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"), GoogleRedirectURL: os.Getenv("GOOGLE_REDIRECT_URL"),
		SMTP: api.SMTPConfig{Host: os.Getenv("SMTP_HOST"), Port: env("SMTP_PORT", "587"), Username: os.Getenv("SMTP_USERNAME"), Password: os.Getenv("SMTP_PASSWORD"), From: os.Getenv("SMTP_FROM"), TLSMode: env("SMTP_TLS_MODE", "starttls")}})
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	workerDone := make(chan struct{})
	go func() { defer close(workerDone); app.RunWorker(ctx) }()
	server := &http.Server{Addr: env("HTTP_ADDR", "127.0.0.1:8080"), Handler: app.Handler(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 << 10}
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdown)
	}()
	slog.Info("Lumyvra backend ready", "address", server.Addr, "generation", "demo")
	if err = server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		slog.Error("http server", "error", err)
		stop()
	}
	stop()
	<-workerDone
}
