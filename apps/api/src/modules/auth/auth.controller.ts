import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { successResponse, errorResponse } from '../../shared/utils/response';
import { ErrorCode } from '../../shared/errors';
import { z } from 'zod';

const authService = new AuthService();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export class AuthController {
  /**
   * POST /api/v1/auth/login
   * Login user and return tokens
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = loginSchema.parse(req.body);

      const result = await authService.login(validated);

      successResponse(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/refresh
   * Refresh access token
   */
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = refreshSchema.parse(req.body);

      const result = await authService.refresh(validated.refreshToken);

      successResponse(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/logout
   * Logout user - revoke refresh token
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        errorResponse(
          res,
          ErrorCode.VALIDATION_ERROR,
          'Refresh token is required',
          req.requestId,
          400
        );
        return;
      }

      const user = (req as any).user;

      await authService.logout(refreshToken, user.id);

      successResponse(res, { message: 'Logged out successfully' }, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/me
   * Get current user profile
   */
  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;

      successResponse(res, user, 200);
    } catch (error) {
      next(error);
    }
  }
}
