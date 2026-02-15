FROM node:20-slim

# Install build tools for native modules (better-sqlite3, bcrypt)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Install Playwright Chromium and ALL its system dependencies
RUN npx playwright install --with-deps chromium

# Copy prisma schema and generate client
COPY prisma/schema.prisma prisma/
RUN npx prisma generate

# Copy application code
COPY src/ src/
COPY public/ public/
COPY prisma/ prisma/
COPY scripts/ scripts/

# Data directory for SQLite databases
RUN mkdir -p /data
ENV DATABASE_URL="file:/data/timesheet.db"
ENV SESSION_DB_PATH="/data/sessions.db"
ENV NODE_ENV=production

EXPOSE 3000

# Run migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
