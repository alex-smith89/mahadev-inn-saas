import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Extract user if already set by JWT guard, else fallback
    const user = (req as any).user ?? null;

    // Always create req.context, even if unauthenticated
    (req as any).context = {
      userId: user?.id ?? null,
      username: user?.username ?? null,
      branch: Array.isArray(user?.branches) ? user.branches[0] : null,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    next();
  }
}