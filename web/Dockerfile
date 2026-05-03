# Echoes Web - Dockerfile
# Multi-stage build for Next.js 14 frontend

# Dependencies stage
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json ./
RUN npm install

# Development stage
FROM node:20-alpine AS development

RUN apk add --no-cache tzdata

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3000

ENV NODE_ENV=development

CMD ["npm", "run", "dev"]

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
