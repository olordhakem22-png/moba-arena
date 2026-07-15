import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  logger.error(`${status} ${message}`, {
    stack: err.stack,
    path: _req.path,
    method: _req.method,
  });

  // Don't leak stack traces in production
  const response: any = { error: message };
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(status).json(response);
}
