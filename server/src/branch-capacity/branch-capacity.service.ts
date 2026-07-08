import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Branch } from '@prisma/client';

@Injectable()
export class BranchCapacityService {
  constructor(private prisma: PrismaService) {}

  async upsert(branch: string | Branch, data: any) {
    const branchEnum = typeof branch === 'string' ? branch as Branch : branch;

    return this.prisma.branchCapacity.upsert({
      where: { branch: branchEnum },
      update: {
        singleCap: data.singleCap || 0,
        doubleCap: data.doubleCap || 0,
        tripleCap: data.tripleCap || 0,
        quardCap: data.quardCap || 0,
      },
      create: {
        branch: branchEnum,
        singleCap: data.singleCap || 0,
        doubleCap: data.doubleCap || 0,
        tripleCap: data.tripleCap || 0,
        quardCap: data.quardCap || 0,
      },
    });
  }

  async findAll() {
    return this.prisma.branchCapacity.findMany();
  }

  async findByBranch(branch: string | Branch) {
    const branchEnum = typeof branch === 'string' ? branch as Branch : branch;
    return this.prisma.branchCapacity.findUnique({
      where: { branch: branchEnum },
    });
  }
}