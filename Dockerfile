# Void Server - Production Dockerfile
# Multi-stage build for optimized production image
# Uses Debian slim images (Alpine musl libc can cause esbuild/Vite issues)

# =============================================================================
# Stage 1: Builder - Install dependencies and build client
# =============================================================================
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files for dependency installation (better layer caching)
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci && cd client && npm ci

# Copy source code
COPY . .

# Build client for production
# Set memory limit to prevent OOM with large dependencies (three.js)
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build --prefix client

# =============================================================================
# Stage 2: Production - Minimal runtime image
# =============================================================================
FROM node:20-slim

WORKDIR /app

# Copy package files and install production deps only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built client from builder
COPY --from=builder /app/client/dist ./client/dist

# Copy server, plugins, and data templates
COPY server/ ./server/
COPY plugins/ ./plugins/
COPY data_template/ ./data_template/

# Create directories for volume mounts
RUN mkdir -p config backups logs data

# Create non-root user for security (Debian syntax)
RUN groupadd -g 1001 voidserver && \
    useradd -u 1001 -g voidserver -m voidserver && \
    chown -R voidserver:voidserver /app

USER voidserver

EXPOSE 4401

# Health check (using node since wget/curl not in slim image)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:4401/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start server directly (Docker handles process management)
CMD ["node", "server/index.js"]
