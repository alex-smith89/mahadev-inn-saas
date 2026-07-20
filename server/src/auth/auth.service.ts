// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Branch } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private auditService: AuditService, // ✅ Inject AuditService
  ) {}

  async login(req: any, body: any) {
    const { username, password, branch } = body;

    console.log('🔐 Login attempt:', { username, branch });

    // Get IP address and user agent
    const ip = req?.ip || req?.connection?.remoteAddress || req?.socket?.remoteAddress || null;
    const userAgent = req?.headers?.['user-agent'] || null;

    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      console.log('❌ User not found:', username);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      console.log('❌ Invalid password for:', username);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Get user branches from UserBranch table
    const userBranches = await this.prisma.userBranch.findMany({
      where: { user_id: user.id },
      select: { branch_name: true },
    });

    const branches = userBranches.map(ub => ub.branch_name);
    console.log('📋 User branches:', branches);

    // Check if user has the selected branch
    if (!branches.includes(branch)) {
      throw new BadRequestException(
        `Branch "${branch}" is not assigned to this user. Available: ${branches.join(', ')}`
      );
    }

    // ✅ Create audit log for login using AuditService
    try {
      const branchEnum = branch as Branch;
      
      await this.auditService.log({
        username: user.username,
        branch: branchEnum,
        action: 'LOGIN',
        entity: 'User',
        entityId: String(user.id),
        details: {
          message: 'User logged in successfully',
          role: user.role,
          branches: branches,
          selectedBranch: branch,
        },
        ip: ip,
        userAgent: userAgent,
      });
      console.log('✅ Audit log created for login:', username, 'Branch:', branch);
    } catch (auditError) {
      console.error('❌ Failed to create audit log:', auditError);
    }

    // Create payload for JWT
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      branches: branches,
      selectedBranch: branch,
      canViewAllBranches: user.canViewAllBranches,
      canCreateBookings: user.canCreateBookings,
    };

    console.log('✅ Login successful for:', username);
    console.log('📦 Payload:', payload);

    const token = this.jwtService.sign(payload);

    // Return user data matching what frontend expects
    const userData = {
      id: user.id,
      username: user.username,
      role: user.role,
      branches: branches,
      selectedBranch: branch,
      canViewAllBranches: user.canViewAllBranches,
      canCreateBookings: user.canCreateBookings,
    };

    return {
      token,
      user: userData,
    };
  }

  // ✅ Logout function with audit trail
  async logout(userId: number, username: string, branch: string, req: any) {
    try {
      const ip = req?.ip || req?.connection?.remoteAddress || null;
      const userAgent = req?.headers?.['user-agent'] || null;

      const branchEnum = branch as Branch;

      await this.auditService.log({
        username: username,
        branch: branchEnum,
        action: 'LOGOUT',
        entity: 'User',
        entityId: String(userId),
        details: {
          message: 'User logged out successfully',
        },
        ip: ip,
        userAgent: userAgent,
      });
      console.log('✅ Audit log created for logout:', username);
    } catch (auditError) {
      console.error('❌ Failed to create logout audit log:', auditError);
    }
    return { success: true, message: 'Logged out successfully' };
  }

  // ✅ Validate token and create audit entry (optional)
  async validateToken(token: string, req: any) {
    try {
      const decoded = this.jwtService.verify(token);
      
      const ip = req?.ip || req?.connection?.remoteAddress || null;
      const userAgent = req?.headers?.['user-agent'] || null;

      const branchEnum = (decoded.selectedBranch || 'Pokhara') as Branch;

      await this.auditService.log({
        username: decoded.username || 'unknown',
        branch: branchEnum,
        action: 'TOKEN_VALIDATE',
        entity: 'User',
        entityId: String(decoded.id || ''),
        details: {
          message: 'Token validated successfully',
        },
        ip: ip,
        userAgent: userAgent,
      });

      return decoded;
    } catch (error) {
      console.error('❌ Token validation failed:', error);
      return null;
    }
  }
}