// src/bookings/bookings.module.ts
import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { AuditService } from '../../apps/api/src/audit/audit.service';

@Module({
  controllers: [BookingsController],
  providers: [
    BookingsService,
    PrismaService,
    EmailService,
    AuditService,
  ],
  exports: [BookingsService],
})
export class BookingsModule {}