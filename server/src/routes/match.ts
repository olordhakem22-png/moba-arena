import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

export const matchRoutes = Router();

matchRoutes.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { page = '1', limit = '20', queueType } = req.query;

    const where: any = {
      status: 'ENDED',
      players: { some: { userId: req.user!.userId } },
    };
    if (queueType) where.queueType = queueType;

    const matches = await prisma.match.findMany({
      where,
      include: {
        players: {
          where: { userId: req.user!.userId },
          select: {
            championId: true, team: true, role: true,
            kills: true, deaths: true, assists: true, grade: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
    });

    res.json({ matches, page: Number(page), limit: Number(limit) });
  } catch (error) {
    next(error);
  }
});

matchRoutes.get('/history', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const players = await prisma.matchPlayer.findMany({
      where: { userId: req.user!.userId },
      include: {
        match: {
          select: {
            id: true, gameMode: true, queueType: true, winner: true,
            createdAt: true, duration: true, status: true,
          },
        },
      },
      orderBy: { match: { createdAt: 'desc' } },
      take: 20,
    });

    const history = players.map(p => ({
      matchId: p.match.id,
      gameMode: p.match.gameMode,
      queueType: p.match.queueType,
      result: p.match.winner === p.team ? 'win' : p.match.winner === 'draw' ? 'draw' : 'loss',
      championId: p.championId,
      role: p.role,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      grade: p.grade,
      date: p.match.createdAt,
      duration: p.match.duration,
    }));

    res.json(history);
  } catch (error) {
    next(error);
  }
});

matchRoutes.get('/:id', async (req, res, next) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: {
        players: {
          include: {
            user: {
              select: { id: true, username: true, avatar: true, rank: true },
            },
          },
        },
      },
    });
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json(match);
  } catch (error) {
    next(error);
  }
});

matchRoutes.post('/custom/create', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const match = await prisma.match.create({
      data: {
        hostId: req.user!.userId,
        gameMode: 'custom',
        queueType: 'custom',
        status: 'PENDING',
      },
    });
    res.status(201).json(match);
  } catch (error) {
    next(error);
  }
});

matchRoutes.post('/:id/join', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const match = await prisma.match.findUnique({ where: { id: req.params.id } });
    if (!match) return res.status(404).json({ error: 'Match not found' });
    if (match.status !== 'PENDING') return res.status(400).json({ error: 'Match already started' });

    const existing = await prisma.matchPlayer.count({ where: { matchId: req.params.id } });
    if (existing >= 10) return res.status(400).json({ error: 'Match is full' });

    const player = await prisma.matchPlayer.create({
      data: {
        matchId: req.params.id,
        userId: req.user!.userId,
        championId: 'lux',
        team: existing < 5 ? 'blue' : 'red',
        role: 'mid',
        summonerSpells: JSON.stringify(['flash', 'ignite']),
        items: '[]',
      },
    });
    res.status(201).json(player);
  } catch (error) {
    next(error);
  }
});
