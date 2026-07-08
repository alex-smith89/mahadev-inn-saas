import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Branch } from '@prisma/client';

@Injectable()
export class AuditService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async log(data: {
    username: string;
    branch?: string | Branch | null;
    action: string;
    entity: string;
    entityId?: string | number | null;
    details?: any;
    ip?: string | null;
    userAgent?: string | null;
  }) {
    // Convert branch to enum if string
    let branchEnum: Branch | null = null;
    if (data.branch) {
      const branchStr = typeof data.branch === 'string' ? data.branch : data.branch;
      if (Object.values(Branch).includes(branchStr as Branch)) {
        branchEnum = branchStr as Branch;
      }
    }

    return this.prisma.auditLog.create({
      data: {
        username: data.username,
        branch: branchEnum,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId ? String(data.entityId) : null,
        details: data.details || {},
        ip: data.ip || null,
        userAgent: data.userAgent || null,
      },
    });
  }

  async findAll(filters: {
    user?: string;
    branch?: string | Branch;
    action?: string;
    from?: string;
    to?: string;
    skip?: number;
    take?: number;
  }) {
    const where: any = {};

    if (filters.user) {
      where.username = filters.user;
    }

    if (filters.branch) {
      const branchStr = typeof filters.branch === 'string' ? filters.branch : filters.branch;
      if (Object.values(Branch).includes(branchStr as Branch)) {
        where.branch = branchStr as Branch;
      }
    }

    if (filters.action) {
      where.action = filters.action;
    }

    if (filters.from) {
      where.createdAt = { gte: new Date(filters.from) };
    }

    if (filters.to) {
      where.createdAt = { ...where.createdAt, lte: new Date(filters.to) };
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: filters.skip || 0,
      take: filters.take || 50,
    });
  }

  async count(filters: {
    user?: string;
    branch?: string | Branch;
    action?: string;
    from?: string;
    to?: string;
  }) {
    const where: any = {};

    if (filters.user) {
      where.username = filters.user;
    }

    if (filters.branch) {
      const branchStr = typeof filters.branch === 'string' ? filters.branch : filters.branch;
      if (Object.values(Branch).includes(branchStr as Branch)) {
        where.branch = branchStr as Branch;
      }
    }

    if (filters.action) {
      where.action = filters.action;
    }

    if (filters.from) {
      where.createdAt = { gte: new Date(filters.from) };
    }

    if (filters.to) {
      where.createdAt = { ...where.createdAt, lte: new Date(filters.to) };
    }

    return this.prisma.auditLog.count({ where });
  }
}