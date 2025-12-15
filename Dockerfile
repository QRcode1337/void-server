# Void Server - Production Dockerfile
# Multi-stage build for optimized production image

# =============================================================================
# Stage 1: Builder - Install dependencies and build client
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files for dependency installation
COPY package*.json ./
COPY client/package*.json ./client/

# Install all dependencies (including devDependencies for build)
RUN npm ci
RUN cd client && npm ci

# Copy source code
COPY . .

# Build client for production
RUN npm run build --prefix client

# =============================================================================
# Stage 2: Production - Minimal runtime image
# =============================================================================
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built client
COPY --from=builder /app/client/dist ./client/dist

# Copy server code
COPY server/ ./server/

# Copy plugins (without their node_modules)
COPY plugins/ ./plugins/

# Install plugin dependencies
RUN for dir in plugins/*/; do \
      if [ -f "${dir}package.json" ]; then \
        cd "$dir" && npm ci --omit=dev 2>/dev/null || npm install --omit=dev; \
        cd /app; \
      fi; \
    done

# Copy ecosystem config
COPY ecosystem.config.js ./

# Create directories for volume mounts
RUN mkdir -p config backups logs data

# Create non-root user for security
RUN addgroup -g 1001 -S voidserver && \
    adduser -S voidserver -u 1001 -G voidserver

# Set ownership
RUN chown -R voidserver:voidserver /app

# Switch to non-root user
USER voidserver

# Expose server port
EXPOSE 4401

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4401/api/health || exit 1

# Start with PM2 runtime (production mode)
CMD ["npx", "pm2-runtime", "ecosystem.config.js", "--env", "production"]
