"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '4000'),
    host: process.env.HOST || '0.0.0.0',
    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-prod',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-prod',
        accessExpiresIn: '15m',
        refreshExpiresIn: '7d',
    },
    database: {
        url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/moba_arena',
    },
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        credentials: true,
    },
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // requests per window
    },
    game: {
        tickRate: 20,
        maxPlayersPerMatch: 10,
        reconnectTimeout: 30,
        inputBufferSize: 128,
    },
    email: {
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
        from: process.env.EMAIL_FROM || 'noreply@mobaarena.com',
    },
};
//# sourceMappingURL=index.js.map