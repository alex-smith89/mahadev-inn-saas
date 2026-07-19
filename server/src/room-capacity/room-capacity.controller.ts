// src/room-capacity/room-capacity.controller.ts
import { Controller, Get, Put, Post, Body, Param, Query, Request, UseGuards, Logger, HttpStatus, HttpException } from '@nestjs/common';
import { RoomCapacityService } from './room-capacity.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('room-capacity')
@UseGuards(JwtAuthGuard)
export class RoomCapacityController {
  private readonly logger = new Logger(RoomCapacityController.name);

  constructor(private readonly roomCapacityService: RoomCapacityService) {}

  @Get('branch/:branch')
  async getBranchCapacity(@Param('branch') branch: string, @Request() req: any) {
    try {
      this.logger.log(`📊 Getting capacity for branch: ${branch}`);
      const result = await this.roomCapacityService.getBranchCapacity(branch, req.user);
      return result;
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put('branch/:branch')
  async updateBranchCapacity(
    @Param('branch') branch: string,
    @Body() body: any,
    @Request() req: any
  ) {
    try {
      this.logger.log(`📊 Updating capacity for branch: ${branch}`);
      this.logger.log(`📊 Data: ${JSON.stringify(body)}`);
      
      const result = await this.roomCapacityService.updateBranchCapacity(branch, body, req.user);
      return result;
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('room-types/:branch')
  async getRoomTypeCapacities(@Param('branch') branch: string, @Request() req: any) {
    try {
      this.logger.log(`📊 Getting room type capacities for branch: ${branch}`);
      const result = await this.roomCapacityService.getRoomTypeCapacities(branch, req.user);
      return result;
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put('room-type/:branch/:roomType')
  async updateRoomTypeCapacity(
    @Param('branch') branch: string,
    @Param('roomType') roomType: string,
    @Body() body: any,
    @Request() req: any
  ) {
    try {
      this.logger.log(`📊 Updating ${roomType} capacity for branch: ${branch}`);
      const result = await this.roomCapacityService.updateRoomTypeCapacity(branch, roomType, body, req.user);
      return result;
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('summary')
  async getCapacitySummary(@Request() req: any) {
    try {
      return await this.roomCapacityService.getCapacitySummary(req.user);
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ NEW: Check room availability endpoint
  @Get('check-availability')
  async checkAvailability(
    @Query('branch') branch: string,
    @Query('roomType') roomType: string,
    @Query('checkIn') checkIn: string,
    @Query('checkOut') checkOut: string,
    @Query('roomsNeeded') roomsNeeded: string
  ) {
    try {
      this.logger.log(`📊 Checking availability for ${roomType} in ${branch}`);
      
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      const needed = parseInt(roomsNeeded) || 1;

      const result = await this.roomCapacityService.checkRoomAvailability(
        branch,
        roomType,
        checkInDate,
        checkOutDate,
        needed
      );

      return result;
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}