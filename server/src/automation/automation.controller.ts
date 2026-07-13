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

  // ✅ SEND REMINDERS
  @Post('reminders')
  @UseGuards(JwtAuthGuard)
  async sendReminders(@Req() req: any) {
    try {
      const user = req.user;

      if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
        throw new ForbiddenException('Permission denied');
      }

      const result = await this.automationService.sendReminders(user);

      return {
        success: true,
        data: result,
        message: result.message,
      };
    } catch (error) {
      this.logger.error('❌ Error:', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  // ✅ GET STATUS
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

  // ✅ FORCE CHECK-IN - THIS WILL DEFINITELY WORK
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

      // Validate branch
      const validBranches = Object.values(Branch);
      if (!validBranches.includes(branchStr as Branch)) {
        return {
          success: false,
          message: `Invalid branch. Valid branches: ${validBranches.join(', ')}`,
        };
      }

      const branchEnum = branchStr as Branch;

      // Get today's date
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find ALL bookings for this branch with check-in today (any status except CheckedIn)
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

      this.logger.log(`📋 Found ${todayBookings.length} bookings to check in`);

      let checkedIn = 0;
      const results = [];

      for (const booking of todayBookings) {
        try {
          this.logger.log(`🔄 Checking in: ${booking.bookingNo} - ${booking.agentName} (Status: ${booking.bookingStatus})`);

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
              createdAt: new Date(),
            },
          });

          results.push(updated);
          checkedIn++;
          this.logger.log(`✅ Checked in: ${booking.bookingNo}`);
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
          bookingStatus: true,
        },
        orderBy: {
          checkIn: 'desc',
        },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

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
          message: `Found ${notCheckedInToday.length} bookings for today that are not checked in`,
        },
      };
    } catch (error) {
      this.logger.error('❌ Error:', error);
      throw new InternalServerErrorException(error.message);
    }
  }
}