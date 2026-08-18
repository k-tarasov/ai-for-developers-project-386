package main

import (
	"log/slog"
	"net/http"
	"os"
	"time"

	"bookingapi/api"
	"bookingapi/internal/config"
	"bookingapi/internal/handler"
	"bookingapi/internal/store"

	"github.com/go-chi/chi/v5"
)

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func loggingMiddleware(logger *slog.Logger, baseURL string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			start := time.Now()
			rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(rec, req)
			
			if rec.status >= http.StatusBadRequest {
				logger.Error("request failed",
					"method", req.Method,
					"path", req.URL.Path,
					"status", rec.status,
					"duration_ms", time.Since(start).Milliseconds(),
				)
			} else {
				logger.Info("request",
					"method", req.Method,
					"path", req.URL.Path,
					"status", rec.status,
					"duration_ms", time.Since(start).Milliseconds(),
				)
			}
		})
	}
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}
	logger := config.InitLogger(cfg.LogLevel)
	slog.SetDefault(logger)

	st := store.New(cfg.LoginMaxAttempts)
	h := handler.New(st, cfg, logger)

	ss := api.NewStrictHandler(h, nil)
	r := chi.NewRouter()
	r.Use(handler.WithRequest)
	r.Use(loggingMiddleware(logger, "/api"))
	api.HandlerFromMuxWithBaseURL(ss, r, "/api")

	logger.Info("starting server", "addr", cfg.ServerAddr)
	if err := http.ListenAndServe(cfg.ServerAddr, r); err != nil {
		logger.Error("server stopped", "error", err)
		os.Exit(1)
	}
}
