const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { audit, auditFrom } = require('../utils/auditLog');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

const register = async (req, res) => {
  try {
    const { email, password, name, isAdmin } = req.body;

    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        isAdmin: isAdmin || false
      },
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        createdAt: true
      }
    });

    res.status(201).json({ message: 'User registered successfully', user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user with full employee data (roles, company info needed for WMS sync button)
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        passwordHash: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            morningStart: true,
            morningEnd: true,
            afternoonStart: true,
            afternoonEnd: true,
            maxDailyHours: true,
            presetAddresses: true,
            roles: {
              include: {
                role: true,
                company: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Set session
    req.session.userId = user.id;
    req.session.isAdmin = user.isAdmin;
    req.session.employeeId = user.employee ? user.employee.id : null;
    req.session.userName = user.name;

    logger.debug('Session set on login', {
      sessionId: req.sessionID,
      userId: req.session.userId,
      cookieSent: !!res.getHeader('set-cookie')
    });

    await audit({
      userId: user.id,
      userName: user.name,
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: user.id,
      ipAddress: req.ip || req.headers?.['x-forwarded-for'] || null
    });

    // Remove passwordHash from response
    const { passwordHash: _, ...userData } = user;
    userData.employeeId = user.employee ? user.employee.id : null;

    res.json({
      message: 'Login successful',
      user: userData
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to log in' });
  }
};

const logout = (req, res) => {
  const userId = req.session?.userId ?? null;
  const userName = req.session?.userName ?? null;
  const ipAddress = req.ip || req.headers?.['x-forwarded-for'] || null;

  req.session.destroy(async (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to log out' });
    }
    await audit({ userId, userName, action: 'USER_LOGOUT', entity: 'User', entityId: userId, ipAddress });
    res.json({ message: 'Logout successful' });
  });
};

const getCurrentUser = async (req, res) => {
  try {
    logger.debug('getCurrentUser check', {
      sessionId: req.sessionID,
      userId: req.session.userId,
      hasCookie: !!req.headers.cookie
    });

    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            morningStart: true,
            morningEnd: true,
            afternoonStart: true,
            afternoonEnd: true,
            maxDailyHours: true,
            presetAddresses: true,
            roles: {
              include: {
                role: true,
                company: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add employeeId at top level for UI convenience
    const userData = {
      ...user,
      employeeId: user.employee ? user.employee.id : null
    };

    res.json({ user: userData });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to get current user' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { name, password, phone, morningStart, morningEnd, afternoonStart, afternoonEnd, presetAddresses } = req.body;

    // Update user name/password
    const userData = {};
    if (name) userData.name = name;
    if (password) {
      userData.passwordHash = await bcrypt.hash(password, 10);
    }

    if (Object.keys(userData).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: userData
      });
    }

    // Update employee profile if exists
    const employee = await prisma.employee.findUnique({ where: { userId } });
    if (employee) {
      const empData = {};
      if (phone !== undefined) empData.phone = phone;
      if (morningStart !== undefined) empData.morningStart = morningStart;
      if (morningEnd !== undefined) empData.morningEnd = morningEnd;
      if (afternoonStart !== undefined) empData.afternoonStart = afternoonStart;
      if (afternoonEnd !== undefined) empData.afternoonEnd = afternoonEnd;
      if (presetAddresses !== undefined) empData.presetAddresses = presetAddresses ? JSON.stringify(presetAddresses) : null;

      if (Object.keys(empData).length > 0) {
        await prisma.employee.update({
          where: { id: employee.id },
          data: empData
        });
      }
    }

    // Return updated user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            morningStart: true,
            morningEnd: true,
            afternoonStart: true,
            afternoonEnd: true,
            maxDailyHours: true,
            presetAddresses: true,
            roles: {
              include: {
                role: true,
                company: true
              }
            }
          }
        }
      }
    });

    res.json({ message: 'Profile updated successfully', user: { ...user, employeeId: user.employee ? user.employee.id : null } });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

module.exports = {
  register,
  login,
  logout,
  getCurrentUser,
  updateProfile
};
