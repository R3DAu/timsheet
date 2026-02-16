#!/bin/sh
set -e

# Force database paths to /app/data volume (overrides any .env values)
export DATABASE_URL="file:/app/data/timesheet.db"
export SESSION_DB_PATH="/app/data/sessions.db"

# Ensure Playwright finds its browser binaries
export PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Write WMS debug screenshots to the persistent data volume
export WMS_DEBUG_DIR=/app/data/wms-debug

# Ensure data directory exists
mkdir -p /app/data

# Run Prisma migrations
npx prisma migrate deploy

# Start the server
exec node src/server.js
