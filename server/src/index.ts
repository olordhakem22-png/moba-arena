import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import compression from 'compression';
import morgan from 'morgan';
import { setupSocketIO } from './socket/index.js';
import { connectDB } from './config/database.js';
import { setupRoutes } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { securityMiddleware } from './middleware/security.js';
import { logger } from './utils/logger.js';
import { config } from './config/index.js';

const app = express();
const httpServer = createServer(app);

// --- Middleware ---
securityMiddleware(app);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(morgan('combined'));

// --- Routes ---
setupRoutes(app);

// --- Socket.IO (Game Server) ---
setupSocketIO(httpServer);

// --- Error Handler ---
app.use(errorHandler);

// --- Start ---
async function start() {
  try {
    await connectDB();
    httpServer.listen(config.port, () => {
      logger.info(`🚀 Server running on port ${config.port}`);
      logger.info(`📡 Socket.IO ready for connections`);
      logger.info(`🔗 API: http://localhost:${config.port}/api`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
