import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BranchCapacityService {
  constructor(private prisma: PrismaService) {}

  async getAll() {
    return this.prisma.branchCapacity.findMany();
  }

  async updateOrCreate(branch: string, data: { singleCap: number; doubleCap: number }) {
    return this.prisma.branchCapacity.upsert({
      where: { branch },
      update: { singleCap: data.singleCap, doubleCap: data.doubleCap },
      create: { branch, singleCap: data.singleCap, doubleCap: data.doubleCap },
    });
  }
}
