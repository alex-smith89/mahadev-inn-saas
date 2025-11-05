// audit/audit.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../src/prisma/prisma.service';
import { RequestContext } from '../common/context/request-context';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {} // ⚠️ Remove self-injection!

  // ✅ NEW: Explicit log method (preferred)
  async log(entry: {
    action: string;
    entity: string;
    entityId?: string | null;
    details?: any;
    branch?: string | null;
    username: string;
    ip?: string | null;
    userAgent?: string | null;
  }) {
    return this.prisma.auditLog.create({
      data: {
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        details:  entry.details ?? {}, // ⚠️ Prisma may require string
        branch: entry.branch ?? null,
        username: entry.username,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  }

  // 🔄 DEPRECATED (or legacy): Log via RequestContext
  // You can keep this temporarily for backward compatibility
  async logFromContext(
    ctx: RequestContext,
    action: string,
    entity?: string,
    entityId?: string,
    details?: any,
  ) {
    return this.log({
      username: ctx.username ?? 'system', // ensure non-null if required
      branch: ctx.branch ?? null,
      action,
      entity: entity ?? 'unknown',
      entityId: entityId ?? null,
      details,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    });
  }

  // ✅ Keep your existing getLogs, findAll, count methods as-is
  async getLogs({
    page = 1,
    limit = 20,
    username,
    action,
    entity,
  }: {
    page?: number;
    limit?: number;
    username?: string;
    action?: string;
    entity?: string;
  }) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (page - 1) * take;

    const where: any = {};
    if (username) where.username = username;
    if (action) where.action = action;
    if (entity) where.entity = entity;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      page,
      limit: take,
      total,
      logs,
    };
  }

  async findAll(params: {
    user?: string;
    branch?: string;
    action?: string;
    from?: string;
    to?: string;
    skip?: number;
    take?: number;
  }) {
    const { user, branch, action, from, to, skip = 0, take = 50 } = params;

    return this.prisma.auditLog.findMany({
      where: {
        ...(user ? { username: user } : {}),
        ...(branch ? { branch } : {}),
        ...(action ? { action } : {}),
        ...(from || to
          ? {
              timestamp: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { timestamp: 'desc' },
      skip,
      take,
    });
  }

  async count(params: {
    user?: string;
    branch?: string;
    action?: string;
    from?: string;
    to?: string;
  }) {
    const { user, branch, action, from, to } = params;

    return this.prisma.auditLog.count({
      where: {
        ...(user ? { username: user } : {}),
        ...(branch ? { branch } : {}),
        ...(action ? { action } : {}),
        ...(from || to
          ? {
              timestamp: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
    });
  }
}