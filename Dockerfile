FROM node:20-slim

# Install dependencies for Playwright Chromium and better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    # Playwright Chromium dependencies
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libxshmfence1 \
    libglib2.0-0 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Install Playwright Chromium browser
RUN npx playwright install chromium

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
