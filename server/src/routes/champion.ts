import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

export const championRoutes = Router();

championRoutes.get('/', async (_req, res, next) => {
  try {
    const champions = await prisma.champion.findMany({
      where: { isEnabled: true },
      include: { stats: true },
      orderBy: { name: 'asc' },
    });
    res.json(champions);
  } catch (error) {
    next(error);
  }
});

championRoutes.get('/:id', async (req, res, next) => {
  try {
    const champion = await prisma.champion.findUnique({
      where: { id: req.params.id },
      include: {
        stats: true,
        abilities: true,
        skins: { where: { isDefault: false } },
      },
    });
    if (!champion) return res.status(404).json({ error: 'Champion not found' });
    res.json(champion);
  } catch (error) {
    next(error);
  }
});

championRoutes.get('/:id/abilities', async (req, res, next) => {
  try {
    const abilities = await prisma.ability.findMany({
      where: { championId: req.params.id },
      orderBy: { key: 'asc' },
    });
    res.json(abilities);
  } catch (error) {
    next(error);
  }
});

championRoutes.get('/:id/skins', async (req, res, next) => {
  try {
    const skins = await prisma.skin.findMany({
      where: { championId: req.params.id },
    });
    res.json(skins);
  } catch (error) {
    next(error);
  }
});

// Get user's mastery on a champion
championRoutes.get('/:id/mastery', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const mastery = await prisma.championMastery.findUnique({
      where: {
        userId_championId: {
          userId: req.user!.userId,
          championId: req.params.id,
        },
      },
    });
    res.json(mastery);
  } catch (error) {
    next(error);
  }
});

// Get all user's champion masteries
championRoutes.get('/me/masteries', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const masteries = await prisma.championMastery.findMany({
      where: { userId: req.user!.userId },
      include: { champion: true },
      orderBy: { points: 'desc' },
    });
    res.json(masteries);
  } catch (error) {
    next(error);
  }
});
