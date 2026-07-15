"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchRoutes = void 0;
const express_1 = require("express");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
exports.matchRoutes = (0, express_1.Router)();
exports.matchRoutes.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const { page = '1', limit = '20', queueType } = req.query;
        const where = {
            status: 'ENDED',
            players: { some: { userId: req.user.userId } },
        };
        if (queueType)
            where.queueType = queueType;
        const matches = await database_1.prisma.match.findMany({
            where,
            include: {
                players: {
                    where: { userId: req.user.userId },
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
    }
    catch (error) {
        next(error);
    }
});
exports.matchRoutes.get('/history', auth_1.authenticate, async (req, res, next) => {
    try {
        const players = await database_1.prisma.matchPlayer.findMany({
            where: { userId: req.user.userId },
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
    }
    catch (error) {
        next(error);
    }
});
exports.matchRoutes.get('/:id', async (req, res, next) => {
    try {
        const match = await database_1.prisma.match.findUnique({
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
        if (!match)
            return res.status(404).json({ error: 'Match not found' });
        res.json(match);
    }
    catch (error) {
        next(error);
    }
});
exports.matchRoutes.post('/custom/create', auth_1.authenticate, async (req, res, next) => {
    try {
        const match = await database_1.prisma.match.create({
            data: {
                hostId: req.user.userId,
                gameMode: 'custom',
                queueType: 'custom',
                status: 'PENDING',
            },
        });
        res.status(201).json(match);
    }
    catch (error) {
        next(error);
    }
});
exports.matchRoutes.post('/:id/join', auth_1.authenticate, async (req, res, next) => {
    try {
        const match = await database_1.prisma.match.findUnique({ where: { id: req.params.id } });
        if (!match)
            return res.status(404).json({ error: 'Match not found' });
        if (match.status !== 'PENDING')
            return res.status(400).json({ error: 'Match already started' });
        const existing = await database_1.prisma.matchPlayer.count({ where: { matchId: req.params.id } });
        if (existing >= 10)
            return res.status(400).json({ error: 'Match is full' });
        const player = await database_1.prisma.matchPlayer.create({
            data: {
                matchId: req.params.id,
                userId: req.user.userId,
                championId: 'lux',
                team: existing < 5 ? 'blue' : 'red',
                role: 'mid',
                summonerSpells: JSON.stringify(['flash', 'ignite']),
                items: '[]',
            },
        });
        res.status(201).json(player);
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=match.js.map