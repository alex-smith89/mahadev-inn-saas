import { Module } from '@nestjs/common';
import { RoomPricingController } from './room-pricing.controller';
import { RoomPricingService } from './room-pricing.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RoomPricingController],
  providers: [RoomPricingService],
  exports: [RoomPricingService]
})
export class RoomPricingModule {}