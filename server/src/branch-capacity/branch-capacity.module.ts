import { Module } from '@nestjs/common';
import { BranchCapacityService } from './branch-capacity.service';
import { BranchCapacityController } from './branch-capacity.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [BranchCapacityController],
  providers: [BranchCapacityService, PrismaService],
})
export class BranchCapacityModule {}
