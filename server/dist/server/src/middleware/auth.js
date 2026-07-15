"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.optionalAuth = optionalAuth;
exports.requireRole = requireRole;
exports.generateTokens = generateTokens;
exports.refreshTokens = refreshTokens;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const index_1 = require("../config/index");
const database_1 = require("../config/database");
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : req.cookies?.accessToken;
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, index_1.config.jwt.accessSecret);
        req.user = payload;
        next();
    }
    catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}
function optionalAuth(req, _res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : req.cookies?.accessToken;
    if (token) {
        try {
            const payload = jsonwebtoken_1.default.verify(token, index_1.config.jwt.accessSecret);
            req.user = payload;
        }
        catch {
            // Ignore invalid token for optional auth
        }
    }
    next();
}
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user)
            return res.status(401).json({ error: 'Authentication required' });
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}
function generateTokens(userId, username, role) {
    const accessToken = jsonwebtoken_1.default.sign({ userId, username, role }, index_1.config.jwt.accessSecret, { expiresIn: index_1.config.jwt.accessExpiresIn });
    const refreshToken = jsonwebtoken_1.default.sign({ userId, username, type: 'refresh' }, index_1.config.jwt.refreshSecret, { expiresIn: index_1.config.jwt.refreshExpiresIn });
    return { accessToken, refreshToken };
}
async function refreshTokens(req, res, next) {
    const oldRefreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    if (!oldRefreshToken) {
        return res.status(401).json({ error: 'Refresh token required' });
    }
    try {
        const payload = jsonwebtoken_1.default.verify(oldRefreshToken, index_1.config.jwt.refreshSecret);
        if (payload.type !== 'refresh') {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }
        // Check if token is in DB and not revoked
        const storedToken = await database_1.prisma.refreshToken.findUnique({
            where: { token: oldRefreshToken },
        });
        if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
            return res.status(401).json({ error: 'Token revoked or expired' });
        }
        // Revoke old token
        await database_1.prisma.refreshToken.update({
            where: { id: storedToken.id },
            data: { isRevoked: true },
        });
        // Generate new tokens
        const tokens = generateTokens(payload.userId, payload.username, payload.role);
        // Store new refresh token
        await database_1.prisma.refreshToken.create({
            data: {
                token: tokens.refreshToken,
                userId: payload.userId,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });
        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: index_1.config.env === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    }
    catch {
        res.status(401).json({ error: 'Invalid refresh token' });
    }
}
//# sourceMappingURL=auth.js.map