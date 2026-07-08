// src/checkout/checkout.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('run-auto-checkout')
  async runAutoCheckout(@Req() req: any) {
    try {
      const user = req.user;
      console.log(`📋 Running auto checkout by: ${user.username} (${user.role})`);

      const result = await this.checkoutService.runAutoCheckout();

      return {
        success: true,
        processed: result.processed || 0,
        notifications: result.notifications || 0,
        emails: result.emails || 0,
        errors: result.errors || 0,
        message: `Processed ${result.processed || 0} checkouts, created ${result.notifications || 0} notifications, sent ${result.emails || 0} emails`,
      };
    } catch (error) {
      console.error('Error in runAutoCheckout:', error);
      return {
        success: false,
        processed: 0,
        notifications: 0,
        emails: 0,
        errors: 1,
        message: error.message || 'Failed to run auto checkout',
      };
    }
  }

  @Get('today')
  async getTodayCheckouts(@Req() req: any) {
    try {
      const user = req.user;
      console.log(`📋 Getting today's checkouts by: ${user.username}`);

      const checkouts = await this.checkoutService.getTodayCheckouts();

      return {
        success: true,
        data: checkouts,
        count: checkouts.length,
      };
    } catch (error) {
      console.error('Error getting today checkouts:', error);
      return {
        success: false,
        data: [],
        count: 0,
        error: error.message,
      };
    }
  }

  @Get('upcoming')
  async getUpcomingCheckouts(
    @Req() req: any,
    @Query('branch') branch?: string,
  ) {
    try {
      const user = req.user;
      
      let targetBranch = branch;
      if (!targetBranch) {
        if (user.role === 'OWNER') {
          targetBranch = user.branches?.[0] || 'Pokhara';
        } else {
          targetBranch = user.branches?.[0] || 'Pokhara';
        }
      }

      const checkouts = await this.checkoutService.getUpcomingCheckouts(targetBranch);

      return {
        success: true,
        data: checkouts,
        count: checkouts.length,
        branch: targetBranch,
      };
    } catch (error) {
      console.error('Error getting upcoming checkouts:', error);
      return {
        success: false,
        data: [],
        count: 0,
        error: error.message,
      };
    }
  }

  @Get('vacant-rooms')
  async getVacantRooms(
    @Req() req: any,
    @Query('branch') branch?: string,
  ) {
    try {
      const user = req.user;
      
      let targetBranch = branch;
      if (!targetBranch) {
        if (user.role === 'OWNER') {
          targetBranch = user.branches?.[0] || 'Pokhara';
        } else {
          targetBranch = user.branches?.[0] || 'Pokhara';
        }
      }

      const result = await this.checkoutService.getVacantRooms(targetBranch);

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      console.error('Error getting vacant rooms:', error);
      return {
        success: false,
        totalRooms: 0,
        occupiedRooms: 0,
        vacantRooms: 0,
        occupancyRate: 0,
        error: error.message,
      };
    }
  }

  @Post('mark-cleaned')
  async markRoomCleaned(
    @Req() req: any,
    @Body() body: { bookingId: string; branch?: string },
  ) {
    try {
      if (!body.bookingId) {
        throw new BadRequestException('bookingId is required');
      }

      const user = req.user;
      console.log(`🧹 Marking room cleaned by: ${user.username}`);

      const result = await this.checkoutService.markRoomCleaned(
        body.bookingId,
        body.branch,
      );

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      console.error('Error marking room cleaned:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('stats')
  async getCheckoutStats(@Req() req: any) {
    try {
      const user = req.user;
      console.log(`📋 Getting checkout stats by: ${user.username}`);

      const todayCheckouts = await this.checkoutService.getTodayCheckouts();
      const upcomingCheckouts = await this.checkoutService.getUpcomingCheckouts();
      const vacantRooms = await this.checkoutService.getVacantRooms();

      return {
        success: true,
        todayCheckouts: todayCheckouts.length,
        upcomingCheckouts: upcomingCheckouts.length,
        vacantRooms: vacantRooms.vacantRooms,
        totalRooms: vacantRooms.totalRooms,
        occupancyRate: vacantRooms.occupancyRate,
      };
    } catch (error) {
      console.error('Error getting checkout stats:', error);
      return {
        success: false,
        todayCheckouts: 0,
        upcomingCheckouts: 0,
        vacantRooms: 0,
        totalRooms: 0,
        occupancyRate: 0,
        error: error.message,
      };
    }
  }

  @Get('test')
  async testCheckout() {
    return {
      message: 'Checkout service is working',
      timestamp: new Date().toISOString(),
    };
  }
}