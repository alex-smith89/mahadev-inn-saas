// src/automation/automation.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { AutomationService } from './automation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('automation')
export class AutomationController {
  private readonly logger = new Logger(AutomationController.name);

  constructor(private readonly automationService: AutomationService) {}

  // ✅ RUN FULL AUTOMATION (Check-in, Check-out, Reminders)
  @Post('run')
  @UseGuards(JwtAuthGuard)
  async runFullAutomation(@Req() req: any) {
    try {
      const user = req.user;
      this.logger.log(`🚀 Running full automation by ${user.username} (${user.role})`);

      // ✅ Check permission - Only OWNER and MANAGER can run automation
      if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
        throw new ForbiddenException('You do not have permission to run automation');
      }

      const result = await this.automationService.runFullAutomation(user);

      return {
        success: true,
        data: result,
        message: `Full automation completed successfully for ${result.branches?.length || 0} branch(es)`,
      };
    } catch (error) {
      this.logger.error('❌ Error running full automation:', error);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message || 'Failed to run automation');
    }
  }

  // ✅ RUN AUTO CHECK-IN ONLY
  @Post('checkin')
  @UseGuards(JwtAuthGuard)
  async runAutoCheckin(@Req() req: any) {
    try {
      const user = req.user;
      this.logger.log(`🔄 Running auto check-in by ${user.username} (${user.role})`);

      // ✅ Check permission - Only OWNER and MANAGER can run automation
      if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
        throw new ForbiddenException('You do not have permission to run check-in automation');
      }

      const result = await this.automationService.runAutoCheckin(user);

      return {
        success: true,
        data: result,
        message: `Auto check-in completed. Checked in ${result.checkedIn} guest(s)`,
      };
    } catch (error) {
      this.logger.error('❌ Error running auto check-in:', error);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message || 'Failed to run check-in automation');
    }
  }

  // ✅ RUN AUTO CHECK-OUT ONLY
  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async runAutoCheckout(@Req() req: any) {
    try {
      const user = req.user;
      this.logger.log(`🔄 Running auto check-out by ${user.username} (${user.role})`);

      // ✅ Check permission - Only OWNER and MANAGER can run automation
      if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
        throw new ForbiddenException('You do not have permission to run check-out automation');
      }

      const result = await this.automationService.runAutoCheckout(user);

      return {
        success: true,
        data: result,
        message: `Auto check-out completed. Checked out ${result.checkedOut} guest(s)`,
      };
    } catch (error) {
      this.logger.error('❌ Error running auto check-out:', error);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message || 'Failed to run check-out automation');
    }
  }

  // ✅ SEND REMINDERS ONLY
  @Post('reminders')
  @UseGuards(JwtAuthGuard)
  async sendReminders(@Req() req: any) {
    try {
      const user = req.user;
      this.logger.log(`📧 Sending reminders by ${user.username} (${user.role})`);

      // ✅ Check permission - Only OWNER and MANAGER can send reminders
      if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
        throw new ForbiddenException('You do not have permission to send reminders');
      }

      const result = await this.automationService.sendReminders(user);

      return {
        success: true,
        data: result,
        message: `Reminders sent. Checkout: ${result.checkoutReminders}, Check-in: ${result.checkinReminders}`,
      };
    } catch (error) {
      this.logger.error('❌ Error sending reminders:', error);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message || 'Failed to send reminders');
    }
  }

  // ✅ GET AUTOMATION STATUS
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getAutomationStatus(@Req() req: any) {
    try {
      const user = req.user;
      this.logger.log(`📊 Getting automation status by ${user.username} (${user.role})`);

      const status = await this.automationService.getAutomationStatus(user);

      return {
        success: true,
        data: status,
        message: 'Automation status retrieved successfully',
      };
    } catch (error) {
      this.logger.error('❌ Error getting automation status:', error);
      throw new InternalServerErrorException(error.message || 'Failed to get automation status');
    }
  }

  // ✅ GET TODAY'S AUTOMATION SUMMARY
  @Get('summary/today')
  @UseGuards(JwtAuthGuard)
  async getTodaySummary(@Req() req: any) {
    try {
      const user = req.user;
      this.logger.log(`📊 Getting today's automation summary by ${user.username} (${user.role})`);

      const summary = await this.automationService.getTodaySummary(user);

      return {
        success: true,
        data: summary,
        message: 'Today\'s automation summary retrieved successfully',
      };
    } catch (error) {
      this.logger.error('❌ Error getting today\'s summary:', error);
      throw new InternalServerErrorException(error.message || 'Failed to get today\'s summary');
    }
  }
}