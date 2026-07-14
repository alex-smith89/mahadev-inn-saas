// src/automation/automation.controller.ts
import {
  Controller,
  Post,
  Get,
  UseGuards,
  Req,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  Body,
  Query,
  Patch,
  Delete,
} from '@nestjs/common';
import { AutomationService } from './automation.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Branch } from '@prisma/client';

@Controller('automation')
export class AutomationController {
  private readonly logger = new Logger(AutomationController.name);

  constructor(
    private readonly automationService: AutomationService,
    private readonly prisma: PrismaService,
  ) {}

  // ✅ RUN AUTO CHECK-IN
  @Post('checkin')
  @UseGuards(JwtAuthGuard)
  async runAutoCheckin(@Req() req: any, @Body() body: any) {
    try {
      const user = req.user;
      const branch = body?.branch;

      this.logger.log(`🔄 Auto check-in by ${user.username}`);
      this.logger.log(`📍 Branch: ${branch || 'not specified'}`);

      if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
        throw new ForbiddenException('Permission denied');
      }

      let result;
      if (branch) {
        result = await this.automationService.runAutoCheckinForBranch(branch, user);
      } else {
        result = await this.automationService.runAutoCheckin(user);
      }

      return {
        success: true,
        data: result,
        message: result.message,
        checkedIn: result.checkedIn || 0,
        checkoutReminders: result.checkoutReminders || 0,
        checkinReminders: result.checkinReminders || 0,
      };
    } catch (error) {
      this.logger.error('❌ Error:', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  // ✅ GET NOTIFICATIONS
  @Get('notifications')
  @UseGuards(JwtAuthGuard)
  async getNotifications(@Req() req: any) {
    try {
      const user = req.user;
      const notifications = await this.automationService.getNotifications(user);
      const unreadCount = await this.automationService.getUnreadNotificationCount(user);

      return {
        success: true,
        data: notifications,
        unreadCount: unreadCount,
        count: notifications.length,
      };
    } catch (error) {
      this.logger.error('❌ Error:', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  // ✅ GET UNREAD NOTIFICATION COUNT
  @Get('notifications/unread/count')
  @UseGuards(JwtAuthGuard)
  async getUnreadCount(@Req() req: any) {
    try {
      const user = req.user;
      const count = await this.automationService.getUnreadNotificationCount(user);

      return {
        success: true,
        unreadCount: count,
      };
    } catch (error) {
      this.logger.error('❌ Error:', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  // ✅ MARK NOTIFICATION AS READ
  @Patch('notifications/:id/read')
  @UseGuards(JwtAuthGuard)
  async markNotificationRead(@Req() req: any, @Query('id') id: string) {
    try {
      const result = await this.automationService.markNotificationRead(id);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error('❌ Error:', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  // ✅ MARK ALL NOTIFICATIONS AS READ
  @Patch('notifications/read/all')
  @UseGuards(JwtAuthGuard)
  async markAllNotificationsRead(@Req() req: any) {
    try {
      const user = req.user;
      const result = await this.automationService.markAllNotificationsRead(user);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error('❌ Error:', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  // ✅ RUN AUTO CHECK-OUT
  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async runAutoCheckout(@Req() req: any) {
    try {
      const user = req.user;

      if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
        throw new ForbiddenException('Permission denied');
      }

      const result = await this.automationService.runAutoCheckout(user);

      return {
        success: true,
        data: result,
        message: result.message,
        checkedOut: result.checkedOut || 0,
      };
    } catch (error) {
      this.logger.error('❌ Error:', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  // ✅ GET TODAY'S SUMMARY
  @Get('summary/today')
  @UseGuards(JwtAuthGuard)
  async getTodaySummary(@Req() req: any) {
    try {
      const user = req.user;
      const summary = await this.automationService.getTodaySummary(user);

      return {
        success: true,
        data: summary,
      };
    } catch (error) {
      this.logger.error('❌ Error:', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  // ✅ GET AUTOMATION STATUS
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Req() req: any) {
    try {
      const user = req.user;
      const status = await this.automationService.getAutomationStatus(user);

      return {
        success: true,
        data: status,
      };
    } catch (error) {
      this.logger.error('❌ Error:', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  // ✅ DEBUG: Check bookings
  @Get('debug')
  @UseGuards(JwtAuthGuard)
  async debug(@Req() req: any, @Query() query: any) {
    try {
      const user = req.user;
      const branch = query?.branch;

      this.logger.log(`🔍 Debug by ${user.username}, branch: ${branch || 'all'}`);

      const where: any = {};
      if (branch && branch !== 'all') {
        const validBranches = Object.values(Branch);
        if (validBranches.includes(branch as Branch)) {
          where.branch = branch as Branch;
        }
      }

      const bookings = await this.prisma.booking.findMany({
        where,
        select: {
          bookingNo: true,
          agentName: true,
          branch: true,
          checkIn: true,
          checkOut: true,
          bookingStatus: true,
          email: true,
          actualCheckIn: true,
          checkoutReminderSent: true,
          checkinReminderSent: true,
        },
        orderBy: {
          checkIn: 'desc',
        },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayBookings = bookings.filter(b => {
        const checkIn = new Date(b.checkIn);
        checkIn.setHours(0, 0, 0, 0);
        return checkIn.getTime() === today.getTime();
      });

      const notCheckedInToday = todayBookings.filter(b => 
        b.bookingStatus !== 'CheckedIn' && b.bookingStatus !== 'CheckedOut'
      );

      return {
        success: true,
        data: {
          total: bookings.length,
          todayBookings: todayBookings.length,
          notCheckedInToday: notCheckedInToday.length,
          bookings: bookings,
          todayBookingsList: todayBookings,
          notCheckedInTodayList: notCheckedInToday,
          message: `Found ${notCheckedInToday.length} bookings for today that are not checked in.`,
        },
      };
    } catch (error) {
      this.logger.error('❌ Error:', error);
      throw new InternalServerErrorException(error.message);
    }
  }
}