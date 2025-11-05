import { Controller, Post, Body } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('trial-signup')
export class TrialSignupController {
  constructor(private prisma: PrismaService) {}

  @Post()
  async create(@Body() data: any) {
    const branches = Array.isArray(data.branches)
      ? data.branches
      : String(data.branches || '')
          .split(',')
          .map((b) => b.trim())
          .filter(Boolean);

    return this.prisma.trialSignup.create({
      data: {
        username: data.username,
        email: data.email,
        phoneNumber: data.phoneNumber,
        companyName: data.companyName,
        branches,
      },
    });
  }
}
