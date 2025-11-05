// auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../../apps/api/src/audit/audit.service'; // 👈 import audit

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private audit: AuditService, // 👈 inject audit
  ) {}

  // 🔐 Validate user + audit login attempts
  async validateUser(username: string, password: string, req: any) {
    const user = await this.users.findByUsername(username);

    // ❌ Failed login
    if (!user) {
      await this.audit.log({
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: username,
        details: { reason: 'User not found' },
        branch: null,
        username,
        ip: req.ip || req.context?.ip || null,
        userAgent: req.headers?.['user-agent'] || req.context?.userAgent || null,
      });
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      await this.audit.log({
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: username,
        details: { reason: 'Invalid credentials' },
        branch: null,
        username,
        ip: req.ip || req.context?.ip || null,
        userAgent: req.headers?.['user-agent'] || req.context?.userAgent || null,
      });
      return null;
    }

    // ✅ Successful login → log it
    await this.audit.log({
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      details: {},
      branch: user.branches?.[0] || null,
      username: user.username,
      ip: req.ip || req.context?.ip || null,
      userAgent: req.headers?.['user-agent'] || req.context?.userAgent || null,
    });

    return user;
  }

  // 🔑 Login: returns JWT token
  async login(username: string, password: string, req: any) {
    const user = await this.validateUser(username, password, req);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      role: user.role,
      branches: user.branches,
      username: user.username,
    };

    const token = await this.jwt.signAsync(payload);

    return {
      token,
      user: {
        id: user.id,
        role: user.role,
        branches: user.branches,
        username: user.username,
      },
    };
  }

  // 🚪 Logout: just audit (token is stateless, so no server-side session to destroy)
  async logout(user: any, req: any) {
    await this.audit.log({
      action: 'LOGOUT',
      entity: 'User',
      entityId:  user.userId, // ✅ CORRECT — matches JWT payload
      details: {},
      branch: user.branches?.[0] || null,
      username: user.username,
      ip: req.ip || req.context?.ip || null,
      userAgent: req.headers?.['user-agent'] || req.context?.userAgent || null,
    });
  }
}