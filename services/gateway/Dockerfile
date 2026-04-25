# Echoes Gateway Service - Dockerfile
# Multi-stage build for Go + Gin API Gateway

# Build stage
FROM golang:alpine AS builder

WORKDIR /app

# Install dependencies
RUN apk add --no-cache git

# Allow automatic Go toolchain download
ENV GOTOOLCHAIN=auto

# Copy go mod files
COPY go.mod ./
RUN go mod download

# Copy source code
COPY . .
RUN go mod tidy

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o gateway cmd/main.go

# Production stage
FROM alpine:latest AS production

WORKDIR /app

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates

# Copy binary from builder
COPY --from=builder /app/gateway .

# Expose port
EXPOSE 8080

# Run the binary
CMD ["./gateway"]

# Development stage
FROM golang:alpine AS development

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod ./
RUN go mod download

COPY . .
RUN go mod tidy

EXPOSE 8080

CMD ["go", "run", "cmd/main.go"]
