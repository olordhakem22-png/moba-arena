import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

export const userRoutes = Router();

userRoutes.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        inventory: true,
        runePages: true,
        championMasteries: {
          include: { champion: true },
          orderBy: { points: 'desc' },
          take: 5,
        },
      },
    });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

userRoutes.get('/me/profile', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true, username: true, avatar: true, level: true, xp: true,
        rank: true, rankLP: true, rankDivision: true, mmr: true,
        wins: true, losses: true, streakWins: true, streakLosses: true,
        totalKills: true, totalDeaths: true, totalAssists: true,
        createdAt: true, status: true, lastSeen: true,
      },
    });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

userRoutes.get('/:id', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, username: true, avatar: true, level: true, rank: true,
        rankDivision: true, wins: true, losses: true, createdAt: true,
        status: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

userRoutes.get('/:id/profile', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, username: true, avatar: true, level: true,
        rank: true, rankDivision: true, wins: true, losses: true,
        totalKills: true, totalDeaths: true, totalAssists: true,
        createdAt: true, status: true,
        championMasteries: {
          include: { champion: true },
          orderBy: { points: 'desc' },
          take: 3,
        },
        matchHistory: {
          include: { match: true },
          orderBy: { match: { createdAt: 'desc' } },
          take: 10,
        },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

userRoutes.put('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { username, avatar } = req.body;
    const updates: any = {};
    if (username) updates.username = username;
    if (avatar) updates.avatar = avatar;

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: updates,
      select: { id: true, username: true, avatar: true },
    });
    res.json(user);
  } catch (error) {
    next(error);
  }
});
