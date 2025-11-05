import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../../../src/auth/jwt-auth.guard';

@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private svc: AuditService) {}

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
  ) {
    const role = req.user.role;
    const userBranches = req.user.branches || [];

    // Managers/Viewers can only see their branch
    if (role !== 'Owner') {
      branch = userBranches[0];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [logs, total] = await Promise.all([
      this.svc.findAll({ user, branch, action, from, to, skip, take }),
      this.svc.count({ user, branch, action, from, to }),
    ]);

    return {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      logs,
    };
  }
}