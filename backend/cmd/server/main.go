package main

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/swarkentin/heart-of-the-beast/backend/internal/httpapi"
	"github.com/swarkentin/heart-of-the-beast/backend/internal/store"
	"github.com/swarkentin/heart-of-the-beast/backend/migrations"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		slog.Error("DATABASE_URL is required")
		os.Exit(1)
	}
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		slog.Error("database configuration failed", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	// Keep the pool deliberately small: Render instances should also work
	// with Neon's pooled connection string and small database plans.
	db.SetMaxOpenConns(8)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(30 * time.Minute)
	db.SetConnMaxIdleTime(5 * time.Minute)

	startupCtx, startupCancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer startupCancel()
	if err := db.PingContext(startupCtx); err != nil {
		slog.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	if err := migrations.Apply(startupCtx, db); err != nil {
		slog.Error("database migrations failed; refusing to start", "error", err)
		os.Exit(1)
	}
	slog.Info("database migrations are up to date")

	api := httpapi.NewHandler(store.NewPostgres(db))
	server := &http.Server{
		Addr:              ":" + port,
		Handler:           withReadiness(db, api),
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	serverErrors := make(chan error, 1)
	go func() {
		slog.Info("backend listening", "address", server.Addr)
		serverErrors <- server.ListenAndServe()
	}()

	select {
	case err := <-serverErrors:
		if !errors.Is(err, http.ErrServerClosed) {
			slog.Error("backend server stopped", "error", err)
			os.Exit(1)
		}
	case <-ctx.Done():
		// Render sends SIGTERM before replacing an instance. Stop accepting
		// new work and allow in-flight requests to finish before the platform's
		// shutdown deadline (configured to 30 seconds in render.yaml).
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			slog.Warn("graceful shutdown deadline reached; closing remaining connections", "error", err)
			_ = server.Close()
		}
	}
}

func withReadiness(db *sql.DB, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/readyz" {
			ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
			defer cancel()
			if err := db.PingContext(ctx); err != nil {
				http.Error(w, "database unavailable", http.StatusServiceUnavailable)
				return
			}
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("{\"status\":\"ready\"}\n"))
			return
		}
		next.ServeHTTP(w, r)
	})
}
