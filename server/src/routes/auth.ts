import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { prisma } from '../config/database';
import { config } from '../config/index';
import { authenticate, generateTokens, refreshTokens } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';

export const authRoutes = Router();

// --- REGISTER ---
authRoutes.post(
  '/register',
  rateLimit(5, 60 * 1000), // 5 per minute
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-20 alphanumeric characters'),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, email, password } = req.body;

      // Check existing
      const existing = await prisma.user.findFirst({
        where: { OR: [{ email }, { username }] },
      });
      if (existing) {
        return res.status(409).json({
          error: existing.email === email ? 'Email already registered' : 'Username taken',
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: {
          username,
          email,
          passwordHash,
          inventory: { create: {} },
        },
        select: {
          id: true, username: true, email: true, avatar: true,
          level: true, rank: true, createdAt: true, role: true,
        },
      });

      const tokens = generateTokens(user.id, user.username, user.role || 'PLAYER');

      res.status(201).json({ user, ...tokens });
    } catch (error) {
      next(error);
    }
  }
);

// --- LOGIN ---
authRoutes.post(
  '/login',
  rateLimit(10, 60 * 1000),
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true, username: true, email: true, avatar: true,
          passwordHash: true, role: true, level: true, rank: true,
          rankLP: true, rankDivision: true, wins: true, losses: true,
          mmr: true, blueEssence: true, rp: true, status: true,
          createdAt: true, isBanned: true, banReason: true,
        },
      });

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (user.isBanned) {
        return res.status(403).json({ error: 'Account banned', reason: user.banReason });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Update status
      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'ONLINE', lastLoginAt: new Date() },
      });

      const { passwordHash: _, ...safeUser } = user;
      const tokens = generateTokens(user.id, user.username, user.role);

      res.json({ user: safeUser, ...tokens });
    } catch (error) {
      next(error);
    }
  }
);

// --- REFRESH TOKEN ---
authRoutes.post('/refresh', refreshTokens);

// --- LOGOUT ---
authRoutes.post('/logout', authenticate, async (req: any, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      await prisma.refreshToken.deleteMany({ where: { token } });
    }
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out' });
  } catch (error) {
    next(error);
  }
});

// --- ME ---
authRoutes.get('/me', authenticate, async (req: any, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true, username: true, email: true, avatar: true, role: true,
        level: true, xp: true, rank: true, rankLP: true, rankDivision: true,
        mmr: true, wins: true, losses: true, streakWins: true, streakLosses: true,
        blueEssence: true, rp: true, status: true, createdAt: true,
        lastSeen: true, lastLoginAt: true,
      },
    });
    res.json(user);
  } catch (error) {
    next(error);
  }
});
