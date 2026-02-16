FROM node:20-slim

# Install build tools for native modules (better-sqlite3, bcrypt)
# AND ca-certificates for HTTPS connections from Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Set consistent browser install location
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Install Playwright Chromium and ALL its system dependencies
# This will run apt-get update internally for the system deps
RUN npx playwright install --with-deps chromium

# Verify Chromium was installed and is executable
RUN npx playwright install --dry-run chromium && \
    echo "Playwright browser path:" && \
    ls -la /ms-playwright/ && \
    echo "Chromium installed successfully"

# Copy prisma schema and generate client
COPY prisma/schema.prisma prisma/
RUN npx prisma generate

# Copy application code
COPY src/ src/
COPY public/ public/
COPY prisma/ prisma/
COPY scripts/ scripts/

# Data directory for SQLite databases
RUN mkdir -p /app/data
#ENV NODE_ENV=production

EXPOSE 3000

COPY ./docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
