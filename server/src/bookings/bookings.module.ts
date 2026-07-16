// src/bookings/bookings.module.ts
import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module'; // ✅ Import this
import { AuditModule } from '../../apps/api/src/audit/audit.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    PrismaModule,
    NotificationModule, // ✅ This provides NotificationService
    AuditModule,
    EmailModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}