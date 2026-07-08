import { Module } from '@nestjs/common';
import { RoomCapacityController } from './room-capacity.controller';
import { RoomCapacityService } from './room-capacity.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RoomCapacityController],
  providers: [RoomCapacityService],
  exports: [RoomCapacityService],
})
export class RoomCapacityModule {}