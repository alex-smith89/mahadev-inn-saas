import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AuditModule } from '../../apps/api/src/audit/audit.module';

@Module({
    imports: [AuditModule], // <-- ADD THIS
    controllers: [BookingsController], 
    providers: [BookingsService, PrismaService] })
export class BookingsModule {}
