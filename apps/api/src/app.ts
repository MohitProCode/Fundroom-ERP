import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { errorHandler, requestIdMiddleware, requestLogger } from './middleware';
import routes from './routes';

/**
 * Express Application Factory
 */
export function createApp(): express.Application {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  }));

  // Rate limiting for authentication endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per window
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts, please try again later',
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Request ID and logging
  app.use(requestIdMiddleware);
  app.use(requestLogger);

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health endpoints
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/ready', async (_req, res) => {
    // TODO: Check database connection
    res.json({ status: 'ready', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api/v1', routes);

  // Apply rate limiting to auth routes
  app.use('/api/v1/auth/login', authLimiter);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
      },
    });
  });

  // Global error handler
  app.use(errorHandler);

  return app;
}
