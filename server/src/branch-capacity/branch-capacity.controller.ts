import { Controller, Get, Put, Body, Param, UseGuards, Req } from '@nestjs/common';
import { BranchCapacityService } from './branch-capacity.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('branch-capacity')
@UseGuards(JwtAuthGuard)
export class BranchCapacityController {
  constructor(private branchCapacityService: BranchCapacityService) {}

  @Get()
  async findAll() {
    return this.branchCapacityService.findAll();  // FIXED: Use findAll
  }

  @Get(':branch')
  async findByBranch(@Param('branch') branch: string) {
    return this.branchCapacityService.findByBranch(branch);
  }

  @Put(':branch')
  async updateOrCreate(
    @Param('branch') branch: string,
    @Body() data: any,
  ) {
    return this.branchCapacityService.upsert(branch, data);  // FIXED: Use upsert
  }
}