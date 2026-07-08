import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        canViewAllBranches: true,
        canCreateBookings: true,
        email: true,
        phone: true,
        created_at: true,
        updated_at: true,
        branches: {
          select: {
            branch_name: true,
          },
        },
      },
    });
  }

  async findOne(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        role: true,
        canViewAllBranches: true,
        canCreateBookings: true,
        email: true,
        phone: true,
        created_at: true,
        updated_at: true,
        branches: {
          select: {
            branch_name: true,
          },
        },
      },
    });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        role: true,
        canViewAllBranches: true,
        canCreateBookings: true,
        email: true,
        phone: true,
        created_at: true,
        updated_at: true,
        branches: {
          select: {
            branch_name: true,
          },
        },
      },
    });
  }

  async update(id: number, data: any) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        role: true,
        canViewAllBranches: true,
        canCreateBookings: true,
        email: true,
        phone: true,
        created_at: true,
        updated_at: true,
        branches: {
          select: {
            branch_name: true,
          },
        },
      },
    });
  }
}