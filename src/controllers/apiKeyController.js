const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

const createApiKey = async (req, res) => {
  try {
    const { name, expiresAt } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Generate key: tsk_ + 48 random hex chars
    const rawKey = 'tsk_' + crypto.randomBytes(24).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 8);

    const apiKey = await prisma.apiKey.create({
      data: {
        keyHash,
        keyPrefix,
        name,
        userId: req.session.userId,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      },
      select: {
        id: true,
        keyPrefix: true,
        name: true,
        expiresAt: true,
        createdAt: true
      }
    });

    // Return the full key ONCE - it cannot be retrieved again
    res.status(201).json({
      apiKey: {
        ...apiKey,
        key: rawKey
      }
    });
  } catch (error) {
    console.error('Create API key error:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
};

const listApiKeys = async (req, res) => {
  try {
    const apiKeys = await prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        keyPrefix: true,
        name: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        user: {
          select: { name: true, email: true }
        }
      }
    });

    res.json({ apiKeys });
  } catch (error) {
    console.error('List API keys error:', error);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
};

const revokeApiKey = async (req, res) => {
  try {
    const { id } = req.params;

    const apiKey = await prisma.apiKey.findUnique({ where: { id: parseInt(id) } });
    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    await prisma.apiKey.update({
      where: { id: parseInt(id) },
      data: { isActive: false }
    });

    res.json({ message: 'API key revoked successfully' });
  } catch (error) {
    console.error('Revoke API key error:', error);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
};

module.exports = {
  createApiKey,
  listApiKeys,
  revokeApiKey
};
