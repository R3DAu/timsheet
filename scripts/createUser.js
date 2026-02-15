#!/usr/bin/env node

/**
 * CLI tool to create users without running a seed script.
 *
 * Usage:
 *   node scripts/createUser.js --email <email> --password <pwd> --name <name> [--admin]
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--admin') {
      args.admin = true;
    } else if (argv[i].startsWith('--')) {
      const key = argv[i].replace('--', '');
      args[key] = argv[++i];
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.email || !args.password || !args.name) {
    console.error('Usage: node scripts/createUser.js --email <email> --password <pwd> --name <name> [--admin]');
    process.exit(1);
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.email)) {
    console.error('Error: Invalid email format');
    process.exit(1);
  }

  // Check uniqueness
  const existing = await prisma.user.findUnique({ where: { email: args.email } });
  if (existing) {
    console.error(`Error: User with email "${args.email}" already exists (ID: ${existing.id})`);
    process.exit(1);
  }

  // Hash password (same salt rounds as authController)
  const passwordHash = await bcrypt.hash(args.password, 10);

  const user = await prisma.user.create({
    data: {
      email: args.email,
      passwordHash,
      name: args.name,
      isAdmin: !!args.admin
    }
  });

  console.log('User created successfully:');
  console.log(`  ID:    ${user.id}`);
  console.log(`  Name:  ${user.name}`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Admin: ${user.isAdmin}`);
}

main()
  .catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
