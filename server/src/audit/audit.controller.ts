// src/audit/audit.controller.ts
import { Controller, Get, Query, UseGuards, Req, Logger, Param } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  private readonly logger = new Logger(AuditController.name);

  constructor(private readonly auditService: AuditService) {}

  @Get()
  async list(
    @Req() req: any,
    @Query('user') user?: string,
    @Query('branch') branch?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
  ) {
    try {
      this.logger.log('📊 Fetching audit logs...');
      
      const role = req.user?.role;
      const userBranches = req.user?.branches || [];
      const username = req.user?.username;

      this.logger.log(`👤 User: ${username} (${role}) - Branches: ${userBranches.join(', ')}`);

      // ✅ Parse pagination
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
      const skip = (pageNum - 1) * limitNum;
      const take = limitNum;

      // ✅ Build filters
      const filters: any = { 
        skip, 
        take,
        user,
        action,
        from,
        to,
      };

      // ✅ Branch filtering logic based on role
      if (role === 'OWNER' || role === 'ADMIN') {
        // Owners/Admins can see all branches or filter by specific branch
        if (branch) {
          filters.branch = branch;
          this.logger.log(`🔓 Admin/Owner filtering by branch: ${branch}`);
        } else {
          this.logger.log('🔓 Admin/Owner viewing all branches');
          // Don't add branch filter - show all
        }
      } else {
        // Managers/Viewers can only see their assigned branches
        if (userBranches.length > 0) {
          if (branch && userBranches.includes(branch)) {
            // User specified a branch they have access to
            filters.branch = branch;
            this.logger.log(`🔒 User filtering by their branch: ${branch}`);
          } else if (branch && !userBranches.includes(branch)) {
            // User tried to access a branch they don't have permission for
            this.logger.warn(`⚠️ User ${username} tried to access unauthorized branch: ${branch}`);
            return {
              success: false,
              data: [],
              total: 0,
              page: pageNum,
              limit: limitNum,
              totalPages: 0,
              stats: {
                totalActions: 0,
                creates: 0,
                updates: 0,
                deletes: 0,
                logins: 0,
                checkins: 0,
                checkouts: 0,
                users: 0,
              },
              error: 'Unauthorized branch access',
            };
          } else {
            // Show all branches the user has access to
            filters.branches = userBranches;
            this.logger.log(`🔒 User viewing all their branches: ${userBranches.join(', ')}`);
          }
        } else {
          this.logger.warn('⚠️ User has no branches assigned');
          return {
            success: true,
            data: [],
            total: 0,
            page: pageNum,
            limit: limitNum,
            totalPages: 0,
            stats: {
              totalActions: 0,
              creates: 0,
              updates: 0,
              deletes: 0,
              logins: 0,
              checkins: 0,
              checkouts: 0,
              users: 0,
            },
          };
        }
      }

      // ✅ Add entity filters if provided
      if (entity) {
        filters.entity = entity;
      }
      if (entityId) {
        filters.entityId = entityId;
      }

      // ✅ Get logs and count in parallel
      const [logs, total] = await Promise.all([
        this.auditService.findAll(filters),
        this.auditService.count(filters),
      ]);

      // ✅ Get stats (with branch filter)
      const stats = await this.auditService.getStats(filters.branch || filters.branches);

      // ✅ Get recent activity (last 24 hours)
      const recentLogs = await this.auditService.getRecentLogs(5, filters.branch || filters.branches);

      this.logger.log(`✅ Found ${logs.length} audit logs (total: ${total})`);

      return {
        success: true,
        data: logs,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        stats,
        recentActivity: recentLogs,
        filters: {
          user: user || null,
          branch: branch || (role === 'OWNER' || role === 'ADMIN' ? 'All' : userBranches.join(', ')),
          action: action || null,
          from: from || null,
          to: to || null,
          entity: entity || null,
          entityId: entityId || null,
        },
      };
    } catch (error) {
      this.logger.error(`❌ Error fetching audit logs: ${error.message}`);
      this.logger.error(`❌ Stack: ${error.stack}`);
      
      return {
        success: false,
        data: [],
        total: 0,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50,
        totalPages: 0,
        stats: {
          totalActions: 0,
          creates: 0,
          updates: 0,
          deletes: 0,
          logins: 0,
          checkins: 0,
          checkouts: 0,
          users: 0,
        },
        recentActivity: [],
        error: error.message,
      };
    }
  }

  // ✅ Get audit statistics only
  @Get('stats')
  async getStats(
    @Req() req: any,
    @Query('branch') branch?: string,
  ) {
    try {
      const role = req.user?.role;
      const userBranches = req.user?.branches || [];

      // ✅ Branch filtering logic
      let filterBranch = null;
      let filterBranches = null;

      if (role === 'OWNER' || role === 'ADMIN') {
        // Owners/Admins can see all branches or filter by specific branch
        if (branch) {
          filterBranch = branch;
        }
      } else {
        // Managers/Viewers can only see their assigned branches
        if (userBranches.length > 0) {
          if (branch && userBranches.includes(branch)) {
            filterBranch = branch;
          } else {
            filterBranches = userBranches;
          }
        } else {
          return {
            success: true,
            stats: {
              totalActions: 0,
              creates: 0,
              updates: 0,
              deletes: 0,
              logins: 0,
              checkins: 0,
              checkouts: 0,
              users: 0,
            },
          };
        }
      }

      const stats = await this.auditService.getStats(filterBranch || filterBranches);

      return {
        success: true,
        stats,
        branch: filterBranch || filterBranches || 'All',
      };
    } catch (error) {
      this.logger.error(`❌ Error fetching audit stats: ${error.message}`);
      return {
        success: false,
        stats: {
          totalActions: 0,
          creates: 0,
          updates: 0,
          deletes: 0,
          logins: 0,
          checkins: 0,
          checkouts: 0,
          users: 0,
        },
        error: error.message,
      };
    }
  }

  // ✅ Get recent audit logs
  @Get('recent')
  async getRecent(
    @Req() req: any,
    @Query('limit') limit: string = '20',
    @Query('branch') branch?: string,
  ) {
    try {
      const role = req.user?.role;
      const userBranches = req.user?.branches || [];

      // ✅ Branch filtering logic
      let filterBranch = null;
      let filterBranches = null;

      if (role === 'OWNER' || role === 'ADMIN') {
        if (branch) {
          filterBranch = branch;
        }
      } else {
        if (userBranches.length > 0) {
          if (branch && userBranches.includes(branch)) {
            filterBranch = branch;
          } else {
            filterBranches = userBranches;
          }
        } else {
          return {
            success: true,
            data: [],
          };
        }
      }

      const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
      const logs = await this.auditService.getRecentLogs(limitNum, filterBranch || filterBranches);

      return {
        success: true,
        data: logs,
        limit: limitNum,
        branch: filterBranch || filterBranches || 'All',
      };
    } catch (error) {
      this.logger.error(`❌ Error fetching recent audit logs: ${error.message}`);
      return {
        success: false,
        data: [],
        error: error.message,
      };
    }
  }

  // ✅ Get audit logs by user
  @Get('user/:username')
  async getByUser(
    @Req() req: any,
    @Param('username') username: string,
    @Query('limit') limit: string = '20',
    @Query('branch') branch?: string,
  ) {
    try {
      const role = req.user?.role;
      const userBranches = req.user?.branches || [];

      // ✅ Check permissions
      let filterBranch = null;
      let filterBranches = null;

      if (role === 'OWNER' || role === 'ADMIN') {
        if (branch) {
          filterBranch = branch;
        }
      } else {
        if (userBranches.length === 0) {
          return {
            success: true,
            data: [],
          };
        }
        if (branch && userBranches.includes(branch)) {
          filterBranch = branch;
        } else {
          filterBranches = userBranches;
        }
      }

      const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
      const logs = await this.auditService.getLogsByUser(username, limitNum, filterBranch || filterBranches);

      return {
        success: true,
        data: logs,
        limit: limitNum,
        user: username,
        branch: filterBranch || filterBranches || 'All',
      };
    } catch (error) {
      this.logger.error(`❌ Error fetching logs for user: ${error.message}`);
      return {
        success: false,
        data: [],
        error: error.message,
      };
    }
  }

  // ✅ Get audit logs by action
  @Get('action/:action')
  async getByAction(
    @Req() req: any,
    @Param('action') action: string,
    @Query('limit') limit: string = '20',
    @Query('branch') branch?: string,
  ) {
    try {
      const role = req.user?.role;
      const userBranches = req.user?.branches || [];

      // ✅ Branch filtering logic
      let filterBranch = null;
      let filterBranches = null;

      if (role === 'OWNER' || role === 'ADMIN') {
        if (branch) {
          filterBranch = branch;
        }
      } else {
        if (userBranches.length > 0) {
          if (branch && userBranches.includes(branch)) {
            filterBranch = branch;
          } else {
            filterBranches = userBranches;
          }
        } else {
          return {
            success: true,
            data: [],
          };
        }
      }

      const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
      const logs = await this.auditService.getLogsByAction(action, limitNum, filterBranch || filterBranches);

      return {
        success: true,
        data: logs,
        limit: limitNum,
        action: action,
        branch: filterBranch || filterBranches || 'All',
      };
    } catch (error) {
      this.logger.error(`❌ Error fetching logs by action: ${error.message}`);
      return {
        success: false,
        data: [],
        error: error.message,
      };
    }
  }

  // ✅ Get audit log summary by date range
  @Get('summary')
  async getSummary(
    @Req() req: any,
    @Query('days') days: string = '7',
    @Query('branch') branch?: string,
  ) {
    try {
      const role = req.user?.role;
      const userBranches = req.user?.branches || [];

      // ✅ Branch filtering logic
      let filterBranch = null;
      let filterBranches = null;

      if (role === 'OWNER' || role === 'ADMIN') {
        if (branch) {
          filterBranch = branch;
        }
      } else {
        if (userBranches.length > 0) {
          if (branch && userBranches.includes(branch)) {
            filterBranch = branch;
          } else {
            filterBranches = userBranches;
          }
        } else {
          return {
            success: true,
            summary: [],
          };
        }
      }

      const daysNum = Math.min(90, Math.max(1, parseInt(days) || 7));
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);

      // ✅ Use the audit service method
      const logs = await this.auditService.getLogsForDateRange(startDate, filterBranch || filterBranches);

      // ✅ Group by date
      const summary: { [key: string]: any } = {};
      logs.forEach(log => {
        const date = log.createdAt.toISOString().split('T')[0];
        if (!summary[date]) {
          summary[date] = {
            date,
            total: 0,
            actions: {},
            users: new Set(),
          };
        }
        summary[date].total++;
        summary[date].actions[log.action] = (summary[date].actions[log.action] || 0) + 1;
        summary[date].users.add(log.username);
      });

      // ✅ Convert to array and convert Sets to arrays
      const summaryArray = Object.values(summary).map((s: any) => ({
        ...s,
        users: Array.from(s.users),
        uniqueUsers: s.users.size,
      }));

      return {
        success: true,
        summary: summaryArray,
        days: daysNum,
        branch: filterBranch || filterBranches || 'All',
      };
    } catch (error) {
      this.logger.error(`❌ Error fetching audit summary: ${error.message}`);
      return {
        success: false,
        summary: [],
        error: error.message,
      };
    }
  }
}