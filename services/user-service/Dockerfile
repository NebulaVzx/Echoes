# Echoes User Service - Dockerfile
# Multi-stage build for Go + GORM user management service

# Build stage
FROM golang:1.23-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod ./
RUN go mod download

COPY . .
RUN go mod tidy

RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o user-service cmd/main.go

# Production stage
FROM alpine:latest AS production

WORKDIR /app

RUN apk --no-cache add ca-certificates

COPY --from=builder /app/user-service .

EXPOSE 8001

CMD ["./user-service"]

# Development stage
FROM golang:1.23-alpine AS development

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod ./
RUN go mod download

COPY . .
RUN go mod tidy

EXPOSE 8001

CMD ["go", "run", "cmd/main.go"]
