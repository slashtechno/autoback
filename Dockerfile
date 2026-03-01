FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bunx svelte-kit sync
RUN bun run build

FROM oven/bun:1
RUN apt-get update && apt-get install -y restic && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/package.json ./
RUN mkdir -p /app/data
EXPOSE 8433
CMD ["sh", "-c", "bun run migrate && node build/index.js"]
