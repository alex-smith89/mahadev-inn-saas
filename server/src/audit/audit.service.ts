// src/audit/audit.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Branch } from '@prisma/client';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  // ✅ Create audit log with improved error handling
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
    try {
      // Validate required fields
      if (!data.username) {
        this.logger.warn('⚠️ Audit log skipped: username is required');
        return null;
      }

      if (!data.action) {
        this.logger.warn('⚠️ Audit log skipped: action is required');
        return null;
      }

      if (!data.entity) {
        this.logger.warn('⚠️ Audit log skipped: entity is required');
        return null;
      }

      // Convert branch to enum if string
      let branchEnum: Branch | null = null;
      if (data.branch) {
        const branchStr = typeof data.branch === 'string' ? data.branch : data.branch;
        if (Object.values(Branch).includes(branchStr as Branch)) {
          branchEnum = branchStr as Branch;
        }
      }

      this.logger.log(`📝 Creating audit log: ${data.action} - ${data.entity} by ${data.username}`);

      const auditLog = await this.prisma.auditLog.create({
        data: {
          username: data.username || 'system',
          branch: branchEnum,
          action: data.action,
          entity: data.entity,
          entityId: data.entityId ? String(data.entityId) : null,
          details: data.details || {},
          ip: data.ip || null,
          userAgent: data.userAgent || null,
          createdAt: new Date(),
        },
      });

      this.logger.log(`✅ Audit log created: ${data.action} - ${data.entity} by ${data.username}`);
      return auditLog;
    } catch (error) {
      this.logger.error(`❌ Failed to create audit log: ${error.message}`);
      // Don't throw error - just log it and return null
      return null;
    }
  }

  // ✅ Alias for log (backward compatibility)
  async logAction(data: {
    username: string;
    branch?: string | Branch | null;
    action: string;
    entity: string;
    entityId?: string | number | null;
    details?: any;
    ip?: string | null;
    userAgent?: string | null;
  }) {
    return this.log(data);
  }

  // ✅ Get all audit logs with filters (UPDATED to support branches array)
  async findAll(filters: {
    user?: string;
    branch?: string | Branch;
    branches?: string[] | Branch[];
    action?: string;
    from?: string;
    to?: string;
    skip?: number;
    take?: number;
    entity?: string;
    entityId?: string;
  }) {
    try {
      const where: any = {};

      if (filters.user) {
        where.username = { contains: filters.user, mode: 'insensitive' };
      }

      // Handle multiple branches
      if (filters.branches && filters.branches.length > 0) {
        const branchValues = filters.branches.map(b => 
          typeof b === 'string' ? b : b
        ).filter(b => Object.values(Branch).includes(b as Branch));
        
        if (branchValues.length > 0) {
          where.branch = { in: branchValues };
        }
      } else if (filters.branch) {
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

      if (filters.entity) {
        where.entity = filters.entity;
      }

      if (filters.entityId) {
        where.entityId = filters.entityId;
      }

      const logs = await this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: filters.skip || 0,
        take: filters.take || 50,
      });

      this.logger.log(`📊 Found ${logs.length} audit logs`);
      return logs;
    } catch (error) {
      this.logger.error(`❌ Error fetching audit logs: ${error.message}`);
      return [];
    }
  }

  // ✅ Count audit logs with filters (UPDATED to support branches array)
  async count(filters: {
    user?: string;
    branch?: string | Branch;
    branches?: string[] | Branch[];
    action?: string;
    from?: string;
    to?: string;
    entity?: string;
    entityId?: string;
  }) {
    try {
      const where: any = {};

      if (filters.user) {
        where.username = { contains: filters.user, mode: 'insensitive' };
      }

      // Handle multiple branches
      if (filters.branches && filters.branches.length > 0) {
        const branchValues = filters.branches.map(b => 
          typeof b === 'string' ? b : b
        ).filter(b => Object.values(Branch).includes(b as Branch));
        
        if (branchValues.length > 0) {
          where.branch = { in: branchValues };
        }
      } else if (filters.branch) {
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

      if (filters.entity) {
        where.entity = filters.entity;
      }

      if (filters.entityId) {
        where.entityId = filters.entityId;
      }

      const count = await this.prisma.auditLog.count({ where });
      this.logger.log(`📊 Counted ${count} audit logs`);
      return count;
    } catch (error) {
      this.logger.error(`❌ Error counting audit logs: ${error.message}`);
      return 0;
    }
  }

  // ✅ Get audit logs with pagination (for frontend)
  async getAuditLogs(where: any, skip: number = 0, take: number = 50) {
    try {
      const logs = await this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      });
      this.logger.log(`📊 Retrieved ${logs.length} audit logs (skip: ${skip}, take: ${take})`);
      return logs;
    } catch (error) {
      this.logger.error(`❌ Error fetching audit logs: ${error.message}`);
      return [];
    }
  }

  // ✅ Count audit logs (for pagination)
  async countAuditLogs(where: any) {
    try {
      const count = await this.prisma.auditLog.count({ where });
      this.logger.log(`📊 Counted ${count} audit logs for pagination`);
      return count;
    } catch (error) {
      this.logger.error(`❌ Error counting audit logs: ${error.message}`);
      return 0;
    }
  }

  // ✅ Get audit statistics (UPDATED to support branch filter)
  async getStats(branchFilter?: string | Branch | string[] | Branch[]) {
    try {
      const where: any = {};

      if (branchFilter) {
        if (Array.isArray(branchFilter)) {
          const branchValues = branchFilter.map(b => 
            typeof b === 'string' ? b : b
          ).filter(b => Object.values(Branch).includes(b as Branch));
          if (branchValues.length > 0) {
            where.branch = { in: branchValues };
          }
        } else {
          const branchStr = typeof branchFilter === 'string' ? branchFilter : branchFilter;
          if (Object.values(Branch).includes(branchStr as Branch)) {
            where.branch = branchStr as Branch;
          }
        }
      }

      const total = await this.prisma.auditLog.count({ where });
      
      const creates = await this.prisma.auditLog.count({
        where: { ...where, action: 'CREATE' },
      });
      
      const updates = await this.prisma.auditLog.count({
        where: { 
          ...where,
          action: { 
            in: ['UPDATE', 'PATCH', 'PUT'] 
          } 
        },
      });
      
      const deletes = await this.prisma.auditLog.count({
        where: { ...where, action: 'DELETE' },
      });
      
      const logins = await this.prisma.auditLog.count({
        where: { ...where, action: 'LOGIN' },
      });

      const checkins = await this.prisma.auditLog.count({
        where: { ...where, action: 'CHECK_IN' },
      });

      const checkouts = await this.prisma.auditLog.count({
        where: { ...where, action: 'CHECK_OUT' },
      });

      // Get unique users
      const users = await this.prisma.auditLog.groupBy({
        by: ['username'],
        where,
        orderBy: { username: 'asc' },
      });

      const stats = {
        totalActions: total,
        creates,
        updates,
        deletes,
        logins,
        checkins,
        checkouts,
        users: users.length,
      };

      this.logger.log(`📊 Audit stats: ${JSON.stringify(stats)}`);
      return stats;
    } catch (error) {
      this.logger.error(`❌ Error getting audit stats: ${error.message}`);
      return {
        totalActions: 0,
        creates: 0,
        updates: 0,
        deletes: 0,
        logins: 0,
        checkins: 0,
        checkouts: 0,
        users: 0,
      };
    }
  }

  // ✅ Get recent audit logs (UPDATED to support branch filter)
  async getRecentLogs(limit: number = 20, branchFilter?: string | Branch | string[] | Branch[]) {
    try {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const where: any = {
        createdAt: { gte: twentyFourHoursAgo },
      };

      if (branchFilter) {
        if (Array.isArray(branchFilter)) {
          const branchValues = branchFilter.map(b => 
            typeof b === 'string' ? b : b
          ).filter(b => Object.values(Branch).includes(b as Branch));
          if (branchValues.length > 0) {
            where.branch = { in: branchValues };
          }
        } else {
          const branchStr = typeof branchFilter === 'string' ? branchFilter : branchFilter;
          if (Object.values(Branch).includes(branchStr as Branch)) {
            where.branch = branchStr as Branch;
          }
        }
      }

      const logs = await this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      this.logger.log(`📊 Found ${logs.length} recent audit logs (last 24 hours)`);
      return logs;
    } catch (error) {
      this.logger.error(`❌ Error fetching recent audit logs: ${error.message}`);
      return [];
    }
  }

  // ✅ Get audit logs by user (UPDATED to support branch filter)
  async getLogsByUser(username: string, limit: number = 20, branchFilter?: string | Branch | string[] | Branch[]) {
    try {
      const where: any = {
        username: { contains: username, mode: 'insensitive' },
      };

      if (branchFilter) {
        if (Array.isArray(branchFilter)) {
          const branchValues = branchFilter.map(b => 
            typeof b === 'string' ? b : b
          ).filter(b => Object.values(Branch).includes(b as Branch));
          if (branchValues.length > 0) {
            where.branch = { in: branchValues };
          }
        } else {
          const branchStr = typeof branchFilter === 'string' ? branchFilter : branchFilter;
          if (Object.values(Branch).includes(branchStr as Branch)) {
            where.branch = branchStr as Branch;
          }
        }
      }

      const logs = await this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      this.logger.log(`📊 Found ${logs.length} audit logs for user: ${username}`);
      return logs;
    } catch (error) {
      this.logger.error(`❌ Error fetching logs for user ${username}: ${error.message}`);
      return [];
    }
  }

  // ✅ Get audit logs by action (UPDATED to support branch filter)
  async getLogsByAction(action: string, limit: number = 20, branchFilter?: string | Branch | string[] | Branch[]) {
    try {
      const where: any = { action };

      if (branchFilter) {
        if (Array.isArray(branchFilter)) {
          const branchValues = branchFilter.map(b => 
            typeof b === 'string' ? b : b
          ).filter(b => Object.values(Branch).includes(b as Branch));
          if (branchValues.length > 0) {
            where.branch = { in: branchValues };
          }
        } else {
          const branchStr = typeof branchFilter === 'string' ? branchFilter : branchFilter;
          if (Object.values(Branch).includes(branchStr as Branch)) {
            where.branch = branchStr as Branch;
          }
        }
      }

      const logs = await this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      this.logger.log(`📊 Found ${logs.length} audit logs for action: ${action}`);
      return logs;
    } catch (error) {
      this.logger.error(`❌ Error fetching logs for action ${action}: ${error.message}`);
      return [];
    }
  }

  // ✅ Get audit logs for a date range (UPDATED to support branch filter)
  async getLogsForDateRange(startDate: Date, branchFilter?: string | Branch | string[] | Branch[]) {
    try {
      const where: any = {
        createdAt: { gte: startDate },
      };

      if (branchFilter) {
        if (Array.isArray(branchFilter)) {
          const branchValues = branchFilter.map(b => 
            typeof b === 'string' ? b : b
          ).filter(b => Object.values(Branch).includes(b as Branch));
          if (branchValues.length > 0) {
            where.branch = { in: branchValues };
          }
        } else {
          const branchStr = typeof branchFilter === 'string' ? branchFilter : branchFilter;
          if (Object.values(Branch).includes(branchStr as Branch)) {
            where.branch = branchStr as Branch;
          }
        }
      }

      const logs = await this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'asc' },
      });

      this.logger.log(`📊 Found ${logs.length} audit logs from ${startDate.toISOString()}`);
      return logs;
    } catch (error) {
      this.logger.error(`❌ Error fetching logs for date range: ${error.message}`);
      return [];
    }
  }

  // ✅ Get audit logs by entity
  async getLogsByEntity(entity: string, entityId?: string, limit: number = 20) {
    try {
      const where: any = { entity };

      if (entityId) {
        where.entityId = entityId;
      }

      const logs = await this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      this.logger.log(`📊 Found ${logs.length} audit logs for entity: ${entity}`);
      return logs;
    } catch (error) {
      this.logger.error(`❌ Error fetching logs for entity ${entity}: ${error.message}`);
      return [];
    }
  }

  // ✅ Get audit logs by IP address
  async getLogsByIp(ip: string, limit: number = 20) {
    try {
      const logs = await this.prisma.auditLog.findMany({
        where: { ip },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      this.logger.log(`📊 Found ${logs.length} audit logs for IP: ${ip}`);
      return logs;
    } catch (error) {
      this.logger.error(`❌ Error fetching logs for IP ${ip}: ${error.message}`);
      return [];
    }
  }

  // ✅ Delete old audit logs (for maintenance)
  async deleteOldLogs(daysToKeep: number = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.prisma.auditLog.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
        },
      });

      this.logger.log(`🗑️ Deleted ${result.count} old audit logs (older than ${daysToKeep} days)`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Error deleting old audit logs: ${error.message}`);
      return { count: 0 };
    }
  }
}