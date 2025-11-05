import { Controller, Get, Put, Param, Body } from '@nestjs/common';
import { BranchCapacityService } from './branch-capacity.service';

@Controller('branch-capacity')
export class BranchCapacityController {
  constructor(private readonly branchCapacityService: BranchCapacityService) {}

  @Get()
  async getAll() {
    return this.branchCapacityService.getAll();
  }

  @Put(':branch')
  async update(
    @Param('branch') branch: string,
    @Body() data: { singleCap: number; doubleCap: number },
  ) {
    return this.branchCapacityService.updateOrCreate(branch, data);
  }
}
