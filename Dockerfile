FROM oven/bun:1.1.34 AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .

FROM oven/bun:1.1.34-slim
WORKDIR /app

RUN addgroup --system --gid 1001 bunuser && \
  adduser --system --uid 1001 --ingroup bunuser --shell /bin/bash bunuser

COPY --from=builder --chown=bunuser:bunuser /app/node_modules ./node_modules
COPY --from=builder --chown=bunuser:bunuser /app/src ./src
COPY --from=builder --chown=bunuser:bunuser /app/package.json ./package.json
COPY --from=builder --chown=bunuser:bunuser /app/tsconfig.json ./tsconfig.json

USER bunuser
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun run -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1))"

CMD ["bun", "src/index.ts"]
