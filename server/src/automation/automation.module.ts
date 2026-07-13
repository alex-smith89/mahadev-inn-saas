// src/automation/automation.module.ts
import { Module } from '@nestjs/common';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AutomationController],
  providers: [
    AutomationService,
    PrismaService,
  ],
  exports: [AutomationService],
})
export class AutomationModule {}