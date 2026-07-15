import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

export const socialRoutes = Router();

// --- FRIENDS ---
socialRoutes.get('/friends', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const friends = await prisma.friend.findMany({
      where: { userId: req.user!.userId },
      include: {
        friend: {
          select: {
            id: true, username: true, avatar: true, status: true, rank: true,
            rankDivision: true, level: true,
          },
        },
      },
    });
    res.json(friends.map(f => f.friend));
  } catch (error) {
    next(error);
  }
});

socialRoutes.post('/friends/request', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { toUserId } = req.body;

    const existing = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { fromUserId: req.user!.userId, toUserId },
          { fromUserId: toUserId, toUserId: req.user!.userId },
        ],
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Request already exists' });
    }

    const request = await prisma.friendRequest.create({
      data: { fromUserId: req.user!.userId, toUserId },
    });
    res.status(201).json(request);
  } catch (error) {
    next(error);
  }
});

socialRoutes.post('/friends/request/:id/accept', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const request = await prisma.friendRequest.findUnique({
      where: { id: req.params.id },
    });

    if (!request || request.toUserId !== req.user!.userId) {
      return res.status(404).json({ error: 'Request not found' });
    }

    await prisma.$transaction([
      prisma.friendRequest.update({
        where: { id: req.params.id },
        data: { status: 'ACCEPTED' },
      }),
      prisma.friend.createMany({
        data: [
          { userId: request.fromUserId, friendId: request.toUserId },
          { userId: request.toUserId, friendId: request.fromUserId },
        ],
      }),
    ]);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// --- CHAT ---
socialRoutes.get('/channels', authenticate, async (_req, res, next) => {
  try {
    const channels = await prisma.chatChannel.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(channels);
  } catch (error) {
    next(error);
  }
});

socialRoutes.get('/channels/:id/messages', authenticate, async (req, res, next) => {
  try {
    const messages = await prisma.chatMessage.findMany({
      where: { channelId: req.params.id, isDeleted: false },
      include: {
        sender: { select: { id: true, username: true, avatar: true, rank: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(messages.reverse());
  } catch (error) {
    next(error);
  }
});

// --- PRESENCE ---
socialRoutes.get('/online', async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { status: { in: ['ONLINE', 'IN_QUEUE', 'IN_GAME'] } },
      select: { id: true, username: true, avatar: true, status: true, rank: true },
      take: 100,
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
});
