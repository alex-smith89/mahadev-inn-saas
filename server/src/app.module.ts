// src/app.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { EmailModule } from './email/email.module';
import { CheckoutModule } from './checkout/checkout.module';
import { NotificationModule } from './notification/notification.module';
import { AutomationModule } from './automation/automation.module';
import { RoomPricingModule } from './room-pricing/room-pricing.module';
import { RoomCapacityModule } from './room-capacity/room-capacity.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BookingsModule,
    EmailModule,
    CheckoutModule,
    NotificationModule,
    AutomationModule,
    RoomPricingModule,
    RoomCapacityModule,
    // AuditModule, // ❌ Remove this line
  ],
})
export class AppModule {}