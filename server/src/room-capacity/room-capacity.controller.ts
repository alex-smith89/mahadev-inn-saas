import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { RoomCapacityService } from './room-capacity.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Branch } from '@prisma/client';

@Controller('room-capacity')
@UseGuards(JwtAuthGuard)
export class RoomCapacityController {
  constructor(private readonly capacityService: RoomCapacityService) {}

  // Get branch capacity
  @Get('branch/:branch')
  async getBranchCapacity(
    @Request() req,
    @Param('branch') branch: Branch
  ) {
    const user = req.user;

    if (user.role !== 'OWNER') {
      throw new ForbiddenException('Only owners can view room capacity');
    }

    return this.capacityService.getBranchCapacity(branch);
  }

  // Update branch capacity
  @Put('branch/:branch')
  async updateBranchCapacity(
    @Request() req,
    @Param('branch') branch: Branch,
    @Body() body: {
      singleCap?: number;
      doubleCap?: number;
      tripleCap?: number;
      quardCap?: number;
    }
  ) {
    const user = req.user;

    if (user.role !== 'OWNER') {
      throw new ForbiddenException('Only owners can update room capacity');
    }

    return this.capacityService.updateBranchCapacity(branch, body);
  }

  // Get all branch capacities
  @Get('branches')
  async getAllBranchCapacities(@Request() req) {
    const user = req.user;

    if (user.role !== 'OWNER') {
      throw new ForbiddenException('Only owners can view room capacity');
    }

    return this.capacityService.getAllBranchCapacities();
  }

  // Get room type capacity for a branch
  @Get('room-types/:branch')
  async getRoomTypeCapacity(
    @Request() req,
    @Param('branch') branch: Branch
  ) {
    const user = req.user;

    if (user.role !== 'OWNER') {
      throw new ForbiddenException('Only owners can view room capacity');
    }

    return this.capacityService.getRoomTypeCapacity(branch);
  }

  // Update room type capacity
  @Put('room-type/:branch/:roomType')
  async updateRoomTypeCapacity(
    @Request() req,
    @Param('branch') branch: Branch,
    @Param('roomType') roomType: string,
    @Body() body: { totalRooms: number }
  ) {
    const user = req.user;

    if (user.role !== 'OWNER') {
      throw new ForbiddenException('Only owners can update room capacity');
    }

    if (!body.totalRooms || body.totalRooms < 0) {
      throw new BadRequestException('Total rooms must be a positive number');
    }

    return this.capacityService.updateRoomTypeCapacity(
      branch,
      roomType,
      body.totalRooms
    );
  }

  // Get capacity summary
  @Get('summary')
  async getCapacitySummary(@Request() req) {
    const user = req.user;

    if (user.role !== 'OWNER') {
      throw new ForbiddenException('Only owners can view capacity summary');
    }

    return this.capacityService.getCapacitySummary();
  }

  // Check availability
  @Post('check-availability')
  async checkAvailability(
    @Request() req,
    @Body() body: {
      branch: Branch;
      roomType: string;
      roomsCount: number;
      checkIn: string;
      checkOut: string;
    }
  ) {
    const user = req.user;

    // Allow managers to check availability for their branch
    if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
      throw new ForbiddenException('You do not have permission to check availability');
    }

    // If manager, only allow their branch
    if (user.role === 'MANAGER') {
      const userBranch = user.branches?.[0];
      if (body.branch !== userBranch) {
        throw new ForbiddenException('You can only check availability for your branch');
      }
    }

    const { branch, roomType, roomsCount, checkIn, checkOut } = body;

    if (!branch || !roomType || !roomsCount || !checkIn || !checkOut) {
      throw new BadRequestException('All fields are required');
    }

    return this.capacityService.checkAvailability(
      branch,
      roomType,
      roomsCount,
      new Date(checkIn),
      new Date(checkOut)
    );
  }
}