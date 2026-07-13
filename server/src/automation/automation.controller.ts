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

  // ✅ RUN AUTO CHECK-IN WITH ALL NOTIFICATIONS
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

  // ✅ RUN FULL AUTOMATION
  @Post('run')
  @UseGuards(JwtAuthGuard)
  async runFullAutomation(@Req() req: any) {
    try {
      const user = req.user;

      if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
        throw new ForbiddenException('Permission denied');
      }

      const result = await this.automationService.runFullAutomation(user);

      return {
        success: true,
        data: result,
        message: 'Full automation completed',
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

  // ✅ GET NOTIFICATIONS
  @Get('notifications')
  @UseGuards(JwtAuthGuard)
  async getNotifications(@Req() req: any) {
    try {
      const user = req.user;
      
      const notifications = await this.prisma.notification.findMany({
        where: {
          branch: user.branch || undefined,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50,
      });

      // Mark as read
      await this.prisma.notification.updateMany({
        where: {
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });

      return {
        success: true,
        data: notifications,
        count: notifications.length,
      };
    } catch (error) {
      this.logger.error('❌ Error:', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  // ✅ FORCE CHECK-IN (For testing)
  @Post('force/checkin')
  @UseGuards(JwtAuthGuard)
  async forceCheckin(@Req() req: any, @Body() body: { branch: string }) {
    try {
      const user = req.user;
      const branchStr = body.branch;

      this.logger.log(`🔧 Force check-in for branch: ${branchStr}`);

      if (!branchStr) {
        throw new ForbiddenException('Branch is required');
      }

      if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
        throw new ForbiddenException('Permission denied');
      }

      const validBranches = Object.values(Branch);
      if (!validBranches.includes(branchStr as Branch)) {
        return {
          success: false,
          message: `Invalid branch. Valid branches: ${validBranches.join(', ')}`,
        };
      }

      const branchEnum = branchStr as Branch;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const allBookings = await this.prisma.booking.findMany({
        where: {
          branch: branchEnum,
        },
      });

      const todayBookings = allBookings.filter(b => {
        const checkIn = new Date(b.checkIn);
        checkIn.setHours(0, 0, 0, 0);
        const isToday = checkIn.getTime() === today.getTime();
        const notCheckedIn = b.bookingStatus !== 'CheckedIn' && b.bookingStatus !== 'CheckedOut';
        return isToday && notCheckedIn;
      });

      let checkedIn = 0;
      const results = [];

      for (const booking of todayBookings) {
        try {
          const updated = await this.prisma.booking.update({
            where: { id: booking.id },
            data: {
              bookingStatus: 'CheckedIn',
              updatedAt: new Date(),
            },
          });

          await this.prisma.notification.create({
            data: {
              title: '🔧 Force Check-in',
              message: `${booking.agentName} (${booking.bookingNo}) force checked in at ${booking.branch}`,
              branch: booking.branch,
              bookingId: booking.id,
              type: 'force_checkin',
              isRead: false,
              createdAt: new Date(),
            },
          });

          results.push(updated);
          checkedIn++;
        } catch (error) {
          this.logger.error(`❌ Error checking in ${booking.bookingNo}:`, error);
        }
      }

      return {
        success: true,
        message: `Force checked in ${checkedIn} guests at ${branchStr}`,
        checkedIn,
        bookings: results,
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
        },
        orderBy: {
          checkIn: 'desc',
        },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(today);
      dayAfter.setDate(dayAfter.getDate() + 2);

      const todayBookings = bookings.filter(b => {
        const checkIn = new Date(b.checkIn);
        checkIn.setHours(0, 0, 0, 0);
        return checkIn.getTime() === today.getTime();
      });

      const notCheckedInToday = todayBookings.filter(b => 
        b.bookingStatus !== 'CheckedIn' && b.bookingStatus !== 'CheckedOut'
      );

      const checkoutTomorrow = bookings.filter(b => {
        const checkOut = new Date(b.checkOut);
        checkOut.setHours(0, 0, 0, 0);
        return checkOut.getTime() === tomorrow.getTime() && 
               ['CheckedIn', 'Confirm'].includes(b.bookingStatus);
      });

      const checkoutDayAfter = bookings.filter(b => {
        const checkOut = new Date(b.checkOut);
        checkOut.setHours(0, 0, 0, 0);
        return checkOut.getTime() === dayAfter.getTime() && 
               ['CheckedIn', 'Confirm'].includes(b.bookingStatus);
      });

      return {
        success: true,
        data: {
          total: bookings.length,
          todayBookings: todayBookings.length,
          notCheckedInToday: notCheckedInToday.length,
          checkoutTomorrow: checkoutTomorrow.length,
          checkoutDayAfter: checkoutDayAfter.length,
          bookings: bookings,
          todayBookingsList: todayBookings,
          notCheckedInTodayList: notCheckedInToday,
          checkoutTomorrowList: checkoutTomorrow,
          checkoutDayAfterList: checkoutDayAfter,
          message: `Found ${notCheckedInToday.length} bookings for today that are not checked in. ${checkoutTomorrow.length} checkouts tomorrow, ${checkoutDayAfter.length} checkouts day after.`,
        },
      };
    } catch (error) {
      this.logger.error('❌ Error:', error);
      throw new InternalServerErrorException(error.message);
    }
  }
}