// Package observability provides logging, tracing, and metrics initialization.
package observability

import (
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// NewLogger creates a Zap logger configured per D-04.
// Uses production JSON format in production env, development format otherwise.
// Fields: timestamp, level, msg, service (static), plus per-request fields added by middleware.
func NewLogger(service string) (*zap.Logger, error) {
	var cfg zap.Config
	if os.Getenv("ENV") == "production" {
		cfg = zap.NewProductionConfig()
	} else {
		cfg = zap.NewDevelopmentConfig()
		cfg.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	}

	cfg.EncoderConfig.TimeKey = "timestamp"
	cfg.EncoderConfig.MessageKey = "msg"
	cfg.EncoderConfig.CallerKey = "caller"
	cfg.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder

	levelStr := os.Getenv("LOG_LEVEL")
	if levelStr == "" {
		levelStr = "info"
	}
	level, err := zapcore.ParseLevel(levelStr)
	if err != nil {
		level = zapcore.InfoLevel
	}
	cfg.Level = zap.NewAtomicLevelAt(level)

	logger, err := cfg.Build(zap.Fields(zap.String("service", service)))
	if err != nil {
		return nil, err
	}
	return logger, nil
}
