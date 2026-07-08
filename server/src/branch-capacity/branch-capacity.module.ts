import { Module } from '@nestjs/common';
import { BranchCapacityController } from './branch-capacity.controller';
import { BranchCapacityService } from './branch-capacity.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BranchCapacityController],
  providers: [BranchCapacityService],
})
export class BranchCapacityModule {}