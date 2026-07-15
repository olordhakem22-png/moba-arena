import express, { Router, Application } from 'express';
import { authRoutes } from './auth.js';
import { userRoutes } from './user.js';
import { championRoutes } from './champion.js';
import { matchRoutes } from './match.js';
import { storeRoutes } from './store.js';
import { socialRoutes } from './social.js';
import { adminRoutes } from './admin.js';

export function setupRoutes(app: Application) {
  const router = Router();

  // Health check
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/champions', championRoutes);
  app.use('/api/matches', matchRoutes);
  app.use('/api/store', storeRoutes);
  app.use('/api/social', socialRoutes);
  app.use('/api/admin', adminRoutes);

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
