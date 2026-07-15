"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = void 0;
const express_1 = require("express");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
exports.userRoutes = (0, express_1.Router)();
exports.userRoutes.get('/me', auth_1.authenticate, async (req, res, next) => {
    try {
        const user = await database_1.prisma.user.findUnique({
            where: { id: req.user.userId },
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
    }
    catch (error) {
        next(error);
    }
});
exports.userRoutes.get('/me/profile', auth_1.authenticate, async (req, res, next) => {
    try {
        const user = await database_1.prisma.user.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true, username: true, avatar: true, level: true, xp: true,
                rank: true, rankLP: true, rankDivision: true, mmr: true,
                wins: true, losses: true, streakWins: true, streakLosses: true,
                totalKills: true, totalDeaths: true, totalAssists: true,
                createdAt: true, status: true, lastSeen: true,
            },
        });
        res.json(user);
    }
    catch (error) {
        next(error);
    }
});
exports.userRoutes.get('/:id', async (req, res, next) => {
    try {
        const user = await database_1.prisma.user.findUnique({
            where: { id: req.params.id },
            select: {
                id: true, username: true, avatar: true, level: true, rank: true,
                rankDivision: true, wins: true, losses: true, createdAt: true,
                status: true,
            },
        });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        res.json(user);
    }
    catch (error) {
        next(error);
    }
});
exports.userRoutes.get('/:id/profile', async (req, res, next) => {
    try {
        const user = await database_1.prisma.user.findUnique({
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
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        res.json(user);
    }
    catch (error) {
        next(error);
    }
});
exports.userRoutes.put('/me', auth_1.authenticate, async (req, res, next) => {
    try {
        const { username, avatar } = req.body;
        const updates = {};
        if (username)
            updates.username = username;
        if (avatar)
            updates.avatar = avatar;
        const user = await database_1.prisma.user.update({
            where: { id: req.user.userId },
            data: updates,
            select: { id: true, username: true, avatar: true },
        });
        res.json(user);
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=user.js.map