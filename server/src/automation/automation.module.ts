// src/automation/automation.module.ts
import { Module } from '@nestjs/common';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationService } from '../notification/notification.service';

@Module({
  controllers: [AutomationController],
  providers: [
    AutomationService,
    PrismaService,
    EmailService,
    NotificationService,
  ],
  exports: [AutomationService],
})
export class AutomationModule {}