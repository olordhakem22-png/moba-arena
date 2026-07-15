"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.socialRoutes = void 0;
const express_1 = require("express");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
exports.socialRoutes = (0, express_1.Router)();
// --- FRIENDS ---
exports.socialRoutes.get('/friends', auth_1.authenticate, async (req, res, next) => {
    try {
        const friends = await database_1.prisma.friend.findMany({
            where: { userId: req.user.userId },
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
    }
    catch (error) {
        next(error);
    }
});
exports.socialRoutes.post('/friends/request', auth_1.authenticate, async (req, res, next) => {
    try {
        const { toUserId } = req.body;
        const existing = await database_1.prisma.friendRequest.findFirst({
            where: {
                OR: [
                    { fromUserId: req.user.userId, toUserId },
                    { fromUserId: toUserId, toUserId: req.user.userId },
                ],
            },
        });
        if (existing) {
            return res.status(400).json({ error: 'Request already exists' });
        }
        const request = await database_1.prisma.friendRequest.create({
            data: { fromUserId: req.user.userId, toUserId },
        });
        res.status(201).json(request);
    }
    catch (error) {
        next(error);
    }
});
exports.socialRoutes.post('/friends/request/:id/accept', auth_1.authenticate, async (req, res, next) => {
    try {
        const request = await database_1.prisma.friendRequest.findUnique({
            where: { id: req.params.id },
        });
        if (!request || request.toUserId !== req.user.userId) {
            return res.status(404).json({ error: 'Request not found' });
        }
        await database_1.prisma.$transaction([
            database_1.prisma.friendRequest.update({
                where: { id: req.params.id },
                data: { status: 'ACCEPTED' },
            }),
            database_1.prisma.friend.createMany({
                data: [
                    { userId: request.fromUserId, friendId: request.toUserId },
                    { userId: request.toUserId, friendId: request.fromUserId },
                ],
            }),
        ]);
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
// --- CHAT ---
exports.socialRoutes.get('/channels', auth_1.authenticate, async (_req, res, next) => {
    try {
        const channels = await database_1.prisma.chatChannel.findMany({
            orderBy: { name: 'asc' },
        });
        res.json(channels);
    }
    catch (error) {
        next(error);
    }
});
exports.socialRoutes.get('/channels/:id/messages', auth_1.authenticate, async (req, res, next) => {
    try {
        const messages = await database_1.prisma.chatMessage.findMany({
            where: { channelId: req.params.id, isDeleted: false },
            include: {
                sender: { select: { id: true, username: true, avatar: true, rank: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        res.json(messages.reverse());
    }
    catch (error) {
        next(error);
    }
});
// --- PRESENCE ---
exports.socialRoutes.get('/online', async (_req, res, next) => {
    try {
        const users = await database_1.prisma.user.findMany({
            where: { status: { in: ['ONLINE', 'IN_QUEUE', 'IN_GAME'] } },
            select: { id: true, username: true, avatar: true, status: true, rank: true },
            take: 100,
        });
        res.json(users);
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=social.js.map