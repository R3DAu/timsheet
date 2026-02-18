#!/bin/sh
set -e

# Set DATABASE_PROVIDER default (sqlite unless overridden)
export DATABASE_PROVIDER="${DATABASE_PROVIDER:-sqlite}"

if [ "$DATABASE_PROVIDER" = "sqlite" ]; then
  # For SQLite: only set DATABASE_URL if not already configured
  export DATABASE_URL="${DATABASE_URL:-file:/app/data/timesheet.db}"
else
  # Non-sqlite provider: patch the schema and regenerate the Prisma client
  # (Prisma does not support env() in the datasource provider field)
  node /app/scripts/set-db-provider.js "${DATABASE_PROVIDER}"
fi

# Ensure Playwright finds its browser binaries
export PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Write WMS debug screenshots to the persistent data volume
export WMS_DEBUG_DIR=/app/data/wms-debug

# Ensure data and log directories exist
mkdir -p /app/data /app/logs

# Run Prisma schema push — works for both SQLite and PostgreSQL
npx prisma db push

# Start the server
exec node src/server.js
