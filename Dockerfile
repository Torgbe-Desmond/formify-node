# ─── Stage 1: deps ───────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ─── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

# Chromium dependencies required by Puppeteer on Alpine
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto \
    && rm -rf /var/cache/apk/*

# Tell Puppeteer to use the system Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Create logs dir and set permissions
RUN mkdir -p logs && chown -R appuser:appgroup /app

USER appuser

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "src/server.js"]
