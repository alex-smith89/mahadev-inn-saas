import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TrialSignupService {
  constructor(private prisma: PrismaService) {}

  async create(data: any) {
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
      branches, // ✅ now an array
    },
  });
}

  async findAll() {
    return this.prisma.trialSignup.findMany({ orderBy: { createdAt: 'desc' } });
  }
}
