package config

import (
	"log/slog"
	"os"

	"github.com/kelseyhightower/envconfig"
)

type Config struct {
	OwnerLogin       string `envconfig:"OWNER_LOGIN" required:"true"`
	OwnerPassword    string `envconfig:"OWNER_PASSWORD" required:"true"`
	ServerAddr       string `envconfig:"SERVER_ADDR" default:":8080"`
	LogLevel         string `envconfig:"LOG_LEVEL" default:"info"`
	LoginMaxAttempts int    `envconfig:"LOGIN_MAX_ATTEMPTS" default:"5"`
}

func Load() (*Config, error) {
	var cfg Config
	if err := envconfig.Process("", &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func InitLogger(level string) *slog.Logger {
	var l slog.Level
	switch level {
	case "debug":
		l = slog.LevelDebug
	case "warn":
		l = slog.LevelWarn
	case "error":
		l = slog.LevelError
	default:
		l = slog.LevelInfo
	}
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: l})
	return slog.New(handler)
}
