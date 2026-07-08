import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
const bcrypt = require('bcryptjs');

@Injectable()
export class TrialSignupService {
  constructor(private prisma: PrismaService) {}

  async create(data: any) {
    let hashedPassword = null;
    if (data.password) {
      hashedPassword = await bcrypt.hash(data.password, 10);
    }
    const createData: any = {
      email: data.email,
      company: data.company || null,
      password: hashedPassword,
      branch: data.branch || 'Pokhara',
      status: 'PENDING',
    };

    if (data.phone) {
      createData.phone = data.phone;
    }

    return this.prisma.trialSignup.create({ data: createData });
  }

  async findAll() {
    return this.prisma.trialSignup.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}