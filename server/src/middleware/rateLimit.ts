import rateLimitLib from 'express-rate-limit';
import { config } from '../config/index.js';

export function rateLimit(max?: number, windowMs?: number) {
  return rateLimitLib({
    windowMs: windowMs ?? config.rateLimit.windowMs,
    max: max ?? config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
    keyGenerator: (req: any) => {
      return req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    },
  });
}
