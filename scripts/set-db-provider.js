#!/usr/bin/env node
/**
 * Patches prisma/schema.prisma to use the specified database provider,
 * then re-runs `prisma generate` so the client matches the provider.
 *
 * Usage:
 *   node scripts/set-db-provider.js sqlite
 *   node scripts/set-db-provider.js postgresql
 *
 * Or via npm scripts:
 *   npm run db:sqlite
 *   npm run db:postgres
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const provider = process.argv[2] || process.env.DATABASE_PROVIDER || 'sqlite';
const supported = ['sqlite', 'postgresql', 'mysql', 'cockroachdb'];

if (!supported.includes(provider)) {
  console.error(`[set-db-provider] Unknown provider "${provider}". Supported: ${supported.join(', ')}`);
  process.exit(1);
}

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
const schema = fs.readFileSync(schemaPath, 'utf8');
const updated = schema.replace(
  /provider = "(sqlite|postgresql|mysql|cockroachdb)"/,
  `provider = "${provider}"`
);

if (schema === updated) {
  console.log(`[set-db-provider] Provider is already "${provider}", skipping write.`);
} else {
  fs.writeFileSync(schemaPath, updated);
  console.log(`[set-db-provider] Updated schema provider to "${provider}".`);
}

console.log('[set-db-provider] Running prisma generate...');
execSync('npx prisma generate', { stdio: 'inherit' });
