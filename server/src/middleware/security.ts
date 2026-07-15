import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import { config } from '../config/index.js';

export function securityMiddleware(app: Express) {
  // Allow Railway domains
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:8080',
    config.cors.origin,
    'https://client-production-1614.up.railway.app',
  ];

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", 
          `ws://localhost:${config.port}`, `http://localhost:${config.port}`,
          'https://api-server-production-633b.up.railway.app',
          'wss://api-server-production-633b.up.railway.app'
        ],
        frameSrc: ["'none'"],
      },
    },
  }));

  // CORS
  app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }));

  // Compression
  app.use(compression());

  // Cookies
  app.use(cookieParser());
}
