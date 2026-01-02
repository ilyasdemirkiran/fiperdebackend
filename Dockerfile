# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Production stage
FROM oven/bun:1-slim

WORKDIR /app

# Create non-root user
RUN groupadd --system --gid 1001 bunuser && \
  useradd --system --uid 1001 --gid bunuser --shell /bin/bash bunuser

# Copy dependencies and source from builder
COPY --from=builder --chown=bunuser:bunuser /app/node_modules ./node_modules
COPY --chown=bunuser:bunuser . .

# Switch to non-root user
USER bunuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun run -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1))"

# Start application
CMD ["bun", "src/index.ts"]
