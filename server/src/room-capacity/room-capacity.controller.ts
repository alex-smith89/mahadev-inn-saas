// src/room-capacity/room-capacity.controller.ts
import { Controller, Get, Put, Body, Param, Request, UseGuards, Logger } from '@nestjs/common';
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
      this.logger.log(`📊 Data received: ${JSON.stringify(body)}`);
      
      // Ensure we have data
      if (!body || Object.keys(body).length === 0) {
        return { error: 'No data provided' };
      }
      
      const result = await this.roomCapacityService.updateBranchCapacity(branch, body, req.user);
      this.logger.log(`✅ Branch capacity updated successfully for ${branch}`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Error updating branch capacity: ${error.message}`);
      return { error: error.message };
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
      const result = await this.roomCapacityService.updateRoomTypeCapacity(branch, roomType, body, req.user);
      return result;
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