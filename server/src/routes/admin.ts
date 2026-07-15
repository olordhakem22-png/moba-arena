import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate, requireRole } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

export const adminRoutes = Router();

adminRoutes.use(authenticate);
adminRoutes.use(requireRole('ADMIN', 'SUPERADMIN'));

adminRoutes.get('/users', async (req, res, next) => {
  try {
    const { page = '1', limit = '50', search, role } = req.query;

    const where: any = {};
    if (search) where.username = { contains: String(search), mode: 'insensitive' };
    if (role) where.role = role;

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true, username: true, email: true, avatar: true, role: true,
        rank: true, wins: true, losses: true, status: true, createdAt: true,
        isBanned: true, lastSeen: true,
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
    });

    const total = await prisma.user.count({ where });
    res.json({ users, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post('/ban', async (req: AuthRequest, res, next) => {
  try {
    const { userId, reason, duration } = req.body;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { isBanned: true, banReason: reason },
      }),
      prisma.adminLog.create({
        data: {
          adminId: req.user!.userId,
          action: 'BAN',
          targetId: userId,
          details: JSON.stringify({ reason, duration }),
        },
      }),
    ]);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post('/unban', async (req: AuthRequest, res, next) => {
  try {
    const { userId } = req.body;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { isBanned: false, banReason: null },
      }),
      prisma.adminLog.create({
        data: {
          adminId: req.user!.userId,
          action: 'UNBAN',
          targetId: userId,
        },
      }),
    ]);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

adminRoutes.get('/reports', async (req, res, next) => {
  try {
    const { status = 'PENDING', page = '1' } = req.query;

    const reports = await prisma.report.findMany({
      where: { status: String(status) as any },
      include: {
        reporter: { select: { id: true, username: true } },
        reported: { select: { id: true, username: true, isBanned: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      skip: (Number(page) - 1) * 20,
    });

    res.json(reports);
  } catch (error) {
    next(error);
  }
});

adminRoutes.post('/reports/:id/review', async (req: AuthRequest, res, next) => {
  try {
    const { action } = req.body;

    await prisma.$transaction([
      prisma.report.update({
        where: { id: req.params.id },
        data: { status: 'REVIEWED' },
      }),
      prisma.adminLog.create({
        data: {
          adminId: req.user!.userId,
          action: `REPORT_${action.toUpperCase()}`,
          targetId: req.params.id,
        },
      }),
    ]);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

adminRoutes.get('/stats', async (_req, res, next) => {
  try {
    const [totalUsers, onlineUsers, totalMatches, activeGames] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ONLINE' } }),
      prisma.match.count({ where: { status: 'ENDED' } }),
      prisma.match.count({ where: { status: 'ACTIVE' } }),
    ]);

    res.json({ totalUsers, onlineUsers, totalMatches, activeGames });
  } catch (error) {
    next(error);
  }
});
