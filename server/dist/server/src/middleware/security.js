"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityMiddleware = securityMiddleware;
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const index_js_1 = require("../config/index.js");
function securityMiddleware(app) {
    // Allow Railway domains
    const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:8080',
        index_js_1.config.cors.origin,
        'https://client-production-1614.up.railway.app',
    ];
    // Security headers
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                imgSrc: ["'self'", "data:", "https:"],
                scriptSrc: ["'self'"],
                connectSrc: ["'self'",
                    `ws://localhost:${index_js_1.config.port}`, `http://localhost:${index_js_1.config.port}`,
                    'https://api-server-production-633b.up.railway.app',
                    'wss://api-server-production-633b.up.railway.app',
                    'https://client-production-1614.up.railway.app'
                ],
                frameSrc: ["'none'"],
            },
        },
    }));
    // CORS
    app.use((0, cors_1.default)({
        origin: allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));
    // Compression
    app.use((0, compression_1.default)());
    // Cookies
    app.use((0, cookie_parser_1.default)());
}
//# sourceMappingURL=security.js.map