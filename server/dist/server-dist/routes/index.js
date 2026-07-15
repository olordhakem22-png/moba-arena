"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRoutes = setupRoutes;
const express_1 = require("express");
const auth_js_1 = require("./auth.js");
const user_js_1 = require("./user.js");
const champion_js_1 = require("./champion.js");
const match_js_1 = require("./match.js");
const store_js_1 = require("./store.js");
const social_js_1 = require("./social.js");
const admin_js_1 = require("./admin.js");
function setupRoutes(app) {
    const router = (0, express_1.Router)();
    // Health check
    router.get('/health', (_req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    // API Routes
    app.use('/api/auth', auth_js_1.authRoutes);
    app.use('/api/users', user_js_1.userRoutes);
    app.use('/api/champions', champion_js_1.championRoutes);
    app.use('/api/matches', match_js_1.matchRoutes);
    app.use('/api/store', store_js_1.storeRoutes);
    app.use('/api/social', social_js_1.socialRoutes);
    app.use('/api/admin', admin_js_1.adminRoutes);
    // API documentation
    app.use('/api/docs', (req, res) => {
        res.json({
            title: 'MOBA Arena API',
            version: '1.0.0',
            endpoints: {
                auth: ['POST /auth/register', 'POST /auth/login', 'POST /auth/refresh', 'POST /auth/logout'],
                users: ['GET /users/me', 'PUT /users/me', 'GET /users/:id', 'GET /users/:id/profile'],
                champions: ['GET /champions', 'GET /champions/:id', 'GET /champions/:id/abilities'],
                matches: ['GET /matches', 'GET /matches/:id', 'GET /matches/:id/replay'],
                store: ['GET /store/items', 'POST /store/purchase', 'GET /store/inventory'],
                social: ['GET /friends', 'POST /friends/request', 'GET /chat/channels'],
                admin: ['GET /admin/users', 'POST /admin/ban', 'POST /admin/mod-action'],
            },
        });
    });
}
//# sourceMappingURL=index.js.map