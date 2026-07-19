// src/room-capacity/room-capacity.controller.ts
import { Controller, Get, Put, Post, Body, Param, Request, UseGuards, Logger } from '@nestjs/common';
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
      return await this.roomCapacityService.getBranchCapacity(branch, req.user);
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      return { error: error.message };
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
      return await this.roomCapacityService.updateBranchCapacity(branch, body, req.user);
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      return { error: error.message };
    }
  }

  @Get('room-types/:branch')
  async getRoomTypeCapacities(@Param('branch') branch: string, @Request() req: any) {
    try {
      this.logger.log(`📊 Getting room type capacities for branch: ${branch}`);
      return await this.roomCapacityService.getRoomTypeCapacities(branch, req.user);
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      return { error: error.message };
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
      return await this.roomCapacityService.updateRoomTypeCapacity(branch, roomType, body, req.user);
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      return { error: error.message };
    }
  }

  @Get('summary')
  async getCapacitySummary(@Request() req: any) {
    try {
      return await this.roomCapacityService.getCapacitySummary(req.user);
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      return { error: error.message };
    }
  }
}