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
  Logger,
} from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('checkout')
export class CheckoutController {
  private readonly logger = new Logger(CheckoutController.name);

  constructor(private readonly checkoutService: CheckoutService) {}

  // ✅ RUN AUTO CHECKOUT
  @Post('auto')
  async runAutoCheckout(@Req() req: any) {
    try {
      const user = req.user;
      this.logger.log(`📋 Running auto checkout by: ${user.username} (${user.role})`);

      // ✅ Call the correct method name - autoCheckout
      const result = await this.checkoutService.autoCheckout(user);

      return {
        success: true,
        processed: result?.checkedOut || 0,
        bookings: result?.bookings || [],
        message: `Processed ${result?.checkedOut || 0} checkouts successfully`,
      };
    } catch (error) {
      this.logger.error('Error in runAutoCheckout:', error);
      return {
        success: false,
        processed: 0,
        bookings: [],
        message: error.message || 'Failed to run auto checkout',
      };
    }
  }

  // ✅ GET TODAY'S CHECKOUTS
  @Get('today')
  async getTodayCheckouts(@Req() req: any) {
    try {
      const user = req.user;
      this.logger.log(`📋 Getting today's checkouts by: ${user.username}`);

      // ✅ Get today's checkouts from service
      const checkouts = await this.checkoutService.getTodayCheckouts(user);

      return {
        success: true,
        data: checkouts || [],
        count: checkouts?.length || 0,
      };
    } catch (error) {
      this.logger.error('Error getting today checkouts:', error);
      return {
        success: false,
        data: [],
        count: 0,
        error: error.message,
      };
    }
  }

  // ✅ GET UPCOMING CHECKOUTS
  @Get('upcoming')
  async getUpcomingCheckouts(
    @Req() req: any,
    @Query('branch') branch?: string,
  ) {
    try {
      const user = req.user;
      
      let targetBranch = branch;
      if (!targetBranch) {
        if (user.role === 'OWNER' || user.role === 'MANAGER') {
          targetBranch = branch || 'all';
        } else {
          targetBranch = user.branches?.[0] || 'Pokhara';
        }
      }

      // ✅ Get upcoming checkouts from service
      const checkouts = await this.checkoutService.getUpcomingCheckouts(user, targetBranch);

      return {
        success: true,
        data: checkouts || [],
        count: checkouts?.length || 0,
        branch: targetBranch,
      };
    } catch (error) {
      this.logger.error('Error getting upcoming checkouts:', error);
      return {
        success: false,
        data: [],
        count: 0,
        error: error.message,
      };
    }
  }

  // ✅ GET VACANT ROOMS
  @Get('vacant-rooms')
  async getVacantRooms(
    @Req() req: any,
    @Query('branch') branch?: string,
  ) {
    try {
      const user = req.user;
      
      let targetBranch = branch;
      if (!targetBranch) {
        if (user.role === 'OWNER' || user.role === 'MANAGER') {
          targetBranch = branch || 'all';
        } else {
          targetBranch = user.branches?.[0] || 'Pokhara';
        }
      }

      // ✅ Get vacant rooms from service
      const result = await this.checkoutService.getVacantRooms(user, targetBranch);

      return {
        success: true,
        totalRooms: result?.totalRooms || 0,
        occupiedRooms: result?.occupiedRooms || 0,
        vacantRooms: result?.vacantRooms || 0,
        occupancyRate: result?.occupancyRate || 0,
        bookings: result?.bookings || [],
        branch: targetBranch,
      };
    } catch (error) {
      this.logger.error('Error getting vacant rooms:', error);
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

  // ✅ MARK ROOM CLEANED
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
      this.logger.log(`🧹 Marking room cleaned by: ${user.username}`);

      // ✅ Mark room cleaned from service
      const result = await this.checkoutService.markRoomCleaned(
        body.bookingId,
        body.branch,
      );

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      this.logger.error('Error marking room cleaned:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ✅ GET CHECKOUT STATS
  @Get('stats')
  async getCheckoutStats(@Req() req: any) {
    try {
      const user = req.user;
      this.logger.log(`📋 Getting checkout stats by: ${user.username}`);

      // ✅ Get all stats from service
      const todayCheckouts = await this.checkoutService.getTodayCheckouts(user);
      const upcomingCheckouts = await this.checkoutService.getUpcomingCheckouts(user);
      const vacantRooms = await this.checkoutService.getVacantRooms(user);

      return {
        success: true,
        todayCheckouts: todayCheckouts?.length || 0,
        upcomingCheckouts: upcomingCheckouts?.length || 0,
        vacantRooms: vacantRooms?.vacantRooms || 0,
        totalRooms: vacantRooms?.totalRooms || 0,
        occupancyRate: vacantRooms?.occupancyRate || 0,
      };
    } catch (error) {
      this.logger.error('Error getting checkout stats:', error);
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

  // ✅ TEST ENDPOINT
  @Get('test')
  async testCheckout() {
    return {
      message: 'Checkout service is working',
      timestamp: new Date().toISOString(),
    };
  }
}