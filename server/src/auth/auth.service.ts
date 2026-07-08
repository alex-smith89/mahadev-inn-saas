import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(req: any, body: any) {
    const { username, password, branch } = body;

    console.log('🔐 Login attempt:', { username, branch });

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
}