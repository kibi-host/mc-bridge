# Build stage
FROM oven/bun:latest AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

RUN bun build src/index --outdir=dist --target=bun

# Production stage
FROM oven/bun:latest

WORKDIR /app

# Copy built application and dependencies from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3001

CMD ["bun", "start"]
