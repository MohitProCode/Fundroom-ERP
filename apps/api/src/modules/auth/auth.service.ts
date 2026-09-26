import { Prisma, PrismaClient, User, UserRole } from '@prisma/client';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { ErrorCode, AuthenticationError } from '../../shared/errors';
import { logger } from '../../shared/utils/logger';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  /**
   * Login user with email and password
   */
  async login(input: LoginInput): Promise<LoginResult> {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (!user) {
      throw new AuthenticationError(ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password');
    }

    if (!user.isActive) {
      throw new AuthenticationError(ErrorCode.UNAUTHORIZED, 'Account is deactivated');
    }

    const isValidPassword = await argon2.verify(user.password, input.password);

    if (!isValidPassword) {
      throw new AuthenticationError(ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password');
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.createRefreshToken(user.id);

    await this.logAudit(user.id, 'LOGIN', 'User', user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh access token
   */
  async refresh(token: string): Promise<RefreshResult> {
    const rotation = await prisma.$transaction(async (tx) => {
      const storedToken = await tx.refreshToken.findUnique({
        where: { token },
        include: { user: true },
      });

      if (!storedToken) {
        throw new AuthenticationError(ErrorCode.INVALID_TOKEN, 'Invalid refresh token');
      }
      if (storedToken.revoked) {
        throw new AuthenticationError(ErrorCode.TOKEN_REVOKED, 'Refresh token has been revoked');
      }
      if (storedToken.expiresAt < new Date()) {
        throw new AuthenticationError(ErrorCode.TOKEN_EXPIRED, 'Refresh token has expired');
      }
      if (!storedToken.user.isActive) {
        throw new AuthenticationError(ErrorCode.UNAUTHORIZED, 'Account is deactivated');
      }

      // Conditional rotation makes concurrent refresh requests mutually exclusive.
      const revoked = await tx.refreshToken.updateMany({
        where: { id: storedToken.id, revoked: false },
        data: { revoked: true },
      });
      if (revoked.count !== 1) {
        throw new AuthenticationError(ErrorCode.TOKEN_REVOKED, 'Refresh token has already been used');
      }

      const nextToken = uuidv4();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await tx.refreshToken.create({
        data: { token: nextToken, userId: storedToken.user.id, expiresAt },
      });

      return { user: storedToken.user, refreshToken: nextToken };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const accessToken = this.generateAccessToken(rotation.user);
    await this.logAudit(rotation.user.id, 'TOKEN_REFRESH', 'User', rotation.user.id);

    return {
      accessToken,
      refreshToken: rotation.refreshToken,
    };
  }

  /**
   * Logout - revoke refresh token
   */
  async logout(token: string, userId: string): Promise<void> {
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token },
    });

    if (storedToken) {
      await prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revoked: true },
      });
    }

    await this.logAudit(userId, 'LOGOUT', 'User', userId);
  }

  /**
   * Generate JWT access token
   */
  private generateAccessToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
  }

  /**
   * Create refresh token in database
   */
  private async createRefreshToken(userId: string): Promise<string> {
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });

    return token;
  }

  /**
   * Log audit event
   */
  private async logAudit(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          actorId,
          action: action as any,
          entityType,
          entityId,
          metadata,
        },
      });
    } catch (error) {
      logger.error('Failed to create audit log', error as Error);
    }
  }
}
