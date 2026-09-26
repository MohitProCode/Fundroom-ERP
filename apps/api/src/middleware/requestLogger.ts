import { Request, Response, NextFunction } from 'express';
import { logger } from '../shared/utils/logger';

/**
 * Request Logger Middleware
 * Logs request duration and response status
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.request(
      req.requestId || 'unknown',
      req.method,
      req.path,
      res.statusCode,
      duration,
      (req as any).user?.id
    );
  });

  next();
}
