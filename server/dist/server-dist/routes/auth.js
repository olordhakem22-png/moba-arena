"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const express_validator_1 = require("express-validator");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const rateLimit_1 = require("../middleware/rateLimit");
exports.authRoutes = (0, express_1.Router)();
// --- REGISTER ---
exports.authRoutes.post('/register', (0, rateLimit_1.rateLimit)(5, 60 * 1000), // 5 per minute
(0, express_validator_1.body)('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-20 alphanumeric characters'), (0, express_validator_1.body)('email').isEmail().normalizeEmail(), (0, express_validator_1.body)('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'), async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { username, email, password } = req.body;
        // Check existing
        const existing = await database_1.prisma.user.findFirst({
            where: { OR: [{ email }, { username }] },
        });
        if (existing) {
            return res.status(409).json({
                error: existing.email === email ? 'Email already registered' : 'Username taken',
            });
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const user = await database_1.prisma.user.create({
            data: {
                username,
                email,
                passwordHash,
                inventory: { create: {} },
            },
            select: {
                id: true, username: true, email: true, avatar: true,
                level: true, rank: true, createdAt: true, role: true,
            },
        });
        const tokens = (0, auth_1.generateTokens)(user.id, user.username, user.role || 'PLAYER');
        res.status(201).json({ user, ...tokens });
    }
    catch (error) {
        next(error);
    }
});
// --- LOGIN ---
exports.authRoutes.post('/login', (0, rateLimit_1.rateLimit)(10, 60 * 1000), (0, express_validator_1.body)('email').isEmail().normalizeEmail(), (0, express_validator_1.body)('password').notEmpty(), async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await database_1.prisma.user.findUnique({
            where: { email },
            select: {
                id: true, username: true, email: true, avatar: true,
                passwordHash: true, role: true, level: true, rank: true,
                rankLP: true, rankDivision: true, wins: true, losses: true,
                mmr: true, blueEssence: true, rp: true, status: true,
                createdAt: true, isBanned: true, banReason: true,
            },
        });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        if (user.isBanned) {
            return res.status(403).json({ error: 'Account banned', reason: user.banReason });
        }
        const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Update status
        await database_1.prisma.user.update({
            where: { id: user.id },
            data: { status: 'ONLINE', lastLoginAt: new Date() },
        });
        const { passwordHash: _, ...safeUser } = user;
        const tokens = (0, auth_1.generateTokens)(user.id, user.username, user.role);
        res.json({ user: safeUser, ...tokens });
    }
    catch (error) {
        next(error);
    }
});
// --- REFRESH TOKEN ---
exports.authRoutes.post('/refresh', auth_1.refreshTokens);
// --- LOGOUT ---
exports.authRoutes.post('/logout', auth_1.authenticate, async (req, res, next) => {
    try {
        const token = req.cookies?.refreshToken;
        if (token) {
            await database_1.prisma.refreshToken.deleteMany({ where: { token } });
        }
        res.clearCookie('refreshToken');
        res.json({ message: 'Logged out' });
    }
    catch (error) {
        next(error);
    }
});
// --- ME ---
exports.authRoutes.get('/me', auth_1.authenticate, async (req, res, next) => {
    try {
        const user = await database_1.prisma.user.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true, username: true, email: true, avatar: true, role: true,
                level: true, xp: true, rank: true, rankLP: true, rankDivision: true,
                mmr: true, wins: true, losses: true, streakWins: true, streakLosses: true,
                blueEssence: true, rp: true, status: true, createdAt: true,
                lastSeen: true, lastLoginAt: true,
            },
        });
        res.json(user);
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=auth.js.map