"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.championRoutes = void 0;
const express_1 = require("express");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
exports.championRoutes = (0, express_1.Router)();
exports.championRoutes.get('/', async (_req, res, next) => {
    try {
        const champions = await database_1.prisma.champion.findMany({
            where: { isEnabled: true },
            include: { stats: true },
            orderBy: { name: 'asc' },
        });
        res.json(champions);
    }
    catch (error) {
        next(error);
    }
});
exports.championRoutes.get('/:id', async (req, res, next) => {
    try {
        const champion = await database_1.prisma.champion.findUnique({
            where: { id: req.params.id },
            include: {
                stats: true,
                abilities: true,
                skins: { where: { isDefault: false } },
            },
        });
        if (!champion)
            return res.status(404).json({ error: 'Champion not found' });
        res.json(champion);
    }
    catch (error) {
        next(error);
    }
});
exports.championRoutes.get('/:id/abilities', async (req, res, next) => {
    try {
        const abilities = await database_1.prisma.ability.findMany({
            where: { championId: req.params.id },
            orderBy: { key: 'asc' },
        });
        res.json(abilities);
    }
    catch (error) {
        next(error);
    }
});
exports.championRoutes.get('/:id/skins', async (req, res, next) => {
    try {
        const skins = await database_1.prisma.skin.findMany({
            where: { championId: req.params.id },
        });
        res.json(skins);
    }
    catch (error) {
        next(error);
    }
});
// Get user's mastery on a champion
exports.championRoutes.get('/:id/mastery', auth_1.authenticate, async (req, res, next) => {
    try {
        const mastery = await database_1.prisma.championMastery.findUnique({
            where: {
                userId_championId: {
                    userId: req.user.userId,
                    championId: req.params.id,
                },
            },
        });
        res.json(mastery);
    }
    catch (error) {
        next(error);
    }
});
// Get all user's champion masteries
exports.championRoutes.get('/me/masteries', auth_1.authenticate, async (req, res, next) => {
    try {
        const masteries = await database_1.prisma.championMastery.findMany({
            where: { userId: req.user.userId },
            include: { champion: true },
            orderBy: { points: 'desc' },
        });
        res.json(masteries);
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=champion.js.map