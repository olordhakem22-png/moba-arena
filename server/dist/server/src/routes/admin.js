"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoutes = void 0;
const express_1 = require("express");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
exports.adminRoutes = (0, express_1.Router)();
exports.adminRoutes.use(auth_1.authenticate);
exports.adminRoutes.use((0, auth_1.requireRole)('ADMIN', 'SUPERADMIN'));
exports.adminRoutes.get('/users', async (req, res, next) => {
    try {
        const { page = '1', limit = '50', search, role } = req.query;
        const where = {};
        if (search)
            where.username = { contains: String(search), mode: 'insensitive' };
        if (role)
            where.role = role;
        const users = await database_1.prisma.user.findMany({
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
        const total = await database_1.prisma.user.count({ where });
        res.json({ users, total, page: Number(page), limit: Number(limit) });
    }
    catch (error) {
        next(error);
    }
});
exports.adminRoutes.post('/ban', async (req, res, next) => {
    try {
        const { userId, reason, duration } = req.body;
        await database_1.prisma.$transaction([
            database_1.prisma.user.update({
                where: { id: userId },
                data: { isBanned: true, banReason: reason },
            }),
            database_1.prisma.adminLog.create({
                data: {
                    adminId: req.user.userId,
                    action: 'BAN',
                    targetId: userId,
                    details: JSON.stringify({ reason, duration }),
                },
            }),
        ]);
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
exports.adminRoutes.post('/unban', async (req, res, next) => {
    try {
        const { userId } = req.body;
        await database_1.prisma.$transaction([
            database_1.prisma.user.update({
                where: { id: userId },
                data: { isBanned: false, banReason: null },
            }),
            database_1.prisma.adminLog.create({
                data: {
                    adminId: req.user.userId,
                    action: 'UNBAN',
                    targetId: userId,
                },
            }),
        ]);
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
exports.adminRoutes.get('/reports', async (req, res, next) => {
    try {
        const { status = 'PENDING', page = '1' } = req.query;
        const reports = await database_1.prisma.report.findMany({
            where: { status: String(status) },
            include: {
                reporter: { select: { id: true, username: true } },
                reported: { select: { id: true, username: true, isBanned: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
            skip: (Number(page) - 1) * 20,
        });
        res.json(reports);
    }
    catch (error) {
        next(error);
    }
});
exports.adminRoutes.post('/reports/:id/review', async (req, res, next) => {
    try {
        const { action } = req.body;
        await database_1.prisma.$transaction([
            database_1.prisma.report.update({
                where: { id: req.params.id },
                data: { status: 'REVIEWED' },
            }),
            database_1.prisma.adminLog.create({
                data: {
                    adminId: req.user.userId,
                    action: `REPORT_${action.toUpperCase()}`,
                    targetId: req.params.id,
                },
            }),
        ]);
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
exports.adminRoutes.get('/stats', async (_req, res, next) => {
    try {
        const [totalUsers, onlineUsers, totalMatches, activeGames] = await Promise.all([
            database_1.prisma.user.count(),
            database_1.prisma.user.count({ where: { status: 'ONLINE' } }),
            database_1.prisma.match.count({ where: { status: 'ENDED' } }),
            database_1.prisma.match.count({ where: { status: 'ACTIVE' } }),
        ]);
        res.json({ totalUsers, onlineUsers, totalMatches, activeGames });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=admin.js.map