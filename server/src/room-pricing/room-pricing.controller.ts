// src/room-pricing/room-pricing.controller.ts
import { Controller, Get, Put, Post, Body, Param, Query, Request, UseGuards, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { RoomPricingService } from './room-pricing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('room-pricing')
@UseGuards(JwtAuthGuard)
export class RoomPricingController {
  private readonly logger = new Logger(RoomPricingController.name);

  constructor(private readonly roomPricingService: RoomPricingService) {}

  // ✅ Get current pricing for a branch
  @Get('current')
  async getCurrentPricing(@Query('branch') branch: string, @Request() req: any) {
    try {
      this.logger.log(`📊 Getting current pricing for branch: ${branch}`);
      
      if (!branch) {
        const user = req.user;
        branch = user?.branches?.[0] || 'Pokhara';
      }

      const result = await this.roomPricingService.getCurrentPricing(branch as any);
      return result;
    } catch (error) {
      this.logger.error(`❌ Error getting current pricing: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Update room price - FIXED with better error handling
  @Put('update')
  async updateRoomPrice(@Body() data: any, @Request() req: any) {
    try {
      this.logger.log(`📊 Updating pricing: ${JSON.stringify(data)}`);
      
      const { branch, roomType, price, season, reason } = data;
      
      // Validate required fields
      if (!branch) {
        throw new HttpException('Branch is required', HttpStatus.BAD_REQUEST);
      }
      if (!roomType) {
        throw new HttpException('Room type is required', HttpStatus.BAD_REQUEST);
      }
      if (price === undefined || price === null) {
        throw new HttpException('Price is required', HttpStatus.BAD_REQUEST);
      }

      // ✅ Ensure price is a number
      const newPrice = Number(price);
      if (isNaN(newPrice) || newPrice < 0) {
        throw new HttpException('Invalid price value', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`📊 Updating ${roomType} to ${newPrice} for branch ${branch}`);

      const result = await this.roomPricingService.updateRoomPrice(
        branch as any,
        roomType,
        newPrice,
        season || 'Regular',
        undefined,
        undefined,
        reason || `Price updated by ${req.user?.username || 'system'}`,
        req.user?.username || 'system'
      );

      this.logger.log(`✅ Successfully updated ${roomType} to ${newPrice} for ${branch}`);

      return {
        success: true,
        message: `Price for ${roomType} updated to ${newPrice}`,
        data: result,
      };
    } catch (error) {
      this.logger.error(`❌ Error updating pricing: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Apply season pricing
  @Post('apply-session')
  async applySession(@Body() data: any, @Request() req: any) {
    try {
      this.logger.log(`📊 Applying session: ${JSON.stringify(data)}`);
      
      const { branch, season, multiplier } = data;
      
      if (!branch || !season || !multiplier) {
        throw new HttpException('Missing required fields: branch, season, multiplier', HttpStatus.BAD_REQUEST);
      }

      const result = await this.roomPricingService.applySessionPricing(
        branch as any,
        season,
        multiplier,
        req.user?.username || 'system'
      );

      return {
        success: true,
        message: `Applied ${season} season pricing to all room types`,
        data: result,
      };
    } catch (error) {
      this.logger.error(`❌ Error applying session: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Get pricing history
  @Get('history')
  async getHistory(@Query('branch') branch: string, @Query('roomType') roomType?: string) {
    try {
      const history = await this.roomPricingService.getPricingHistory(branch as any, roomType);
      return history;
    } catch (error) {
      this.logger.error(`❌ Error getting history: ${error.message}`);
      return [];
    }
  }

  // ✅ Get sessions
  @Get('sessions')
  async getSessions() {
    try {
      const sessions = await this.roomPricingService.getAllSessions();
      return sessions;
    } catch (error) {
      this.logger.error(`❌ Error getting sessions: ${error.message}`);
      return [];
    }
  }

  // ✅ Get current session
  @Get('session')
  async getCurrentSession() {
    try {
      const session = await this.roomPricingService.getCurrentSession();
      return session;
    } catch (error) {
      this.logger.error(`❌ Error getting current session: ${error.message}`);
      return { currentSeason: 'Regular', description: 'Regular season pricing', multiplier: 1.0 };
    }
  }

  // ✅ Get pricing suggestions
  @Get('suggestions')
  async getSuggestions(@Query('branch') branch: string) {
    try {
      const suggestions = await this.roomPricingService.getPricingSuggestions(branch as any);
      return suggestions;
    } catch (error) {
      this.logger.error(`❌ Error getting suggestions: ${error.message}`);
      return { error: error.message };
    }
  }

  // ✅ Get room types
  @Get('room-types')
  async getRoomTypes() {
    try {
      const roomTypes = await this.roomPricingService.getRoomTypes();
      return roomTypes;
    } catch (error) {
      this.logger.error(`❌ Error getting room types: ${error.message}`);
      return [];
    }
  }
}