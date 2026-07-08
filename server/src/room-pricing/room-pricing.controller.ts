import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { RoomPricingService } from './room-pricing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Branch } from '@prisma/client';

@Controller('room-pricing')
@UseGuards(JwtAuthGuard)
export class RoomPricingController {
  constructor(private readonly pricingService: RoomPricingService) {}

  @Get('session')
  async getCurrentSession() {
    return this.pricingService.getCurrentSession();
  }

  @Get('sessions')
  async getAllSessions() {
    return this.pricingService.getAllSessions();
  }

  @Get('current')
  async getCurrentPricing(
    @Request() req,
    @Query('branch') branch?: Branch,
    @Query('roomType') roomType?: string
  ) {
    const user = req.user;
    const targetBranch = branch || user.branches?.[0];

    if (user.role !== 'OWNER') {
      throw new ForbiddenException('Only owners can view room pricing');
    }

    if (!targetBranch) {
      throw new BadRequestException('Branch is required');
    }

    return this.pricingService.getCurrentPricing(targetBranch as Branch, roomType);
  }

  @Put('update')
  async updateRoomPrice(
    @Request() req,
    @Body() body: {
      branch: Branch;
      roomType: string;
      price: number;
      season: string;
      startDate?: string;
      endDate?: string;
      reason?: string;
    }
  ) {
    const user = req.user;

    if (user.role !== 'OWNER') {
      throw new ForbiddenException('Only owners can update room pricing');
    }

    const { branch, roomType, price, season, startDate, endDate, reason } = body;

    if (!branch || !roomType || !price || !season) {
      throw new BadRequestException('Branch, roomType, price, and season are required');
    }

    if (price <= 0) {
      throw new BadRequestException('Price must be greater than 0');
    }

    return this.pricingService.updateRoomPrice(
      branch,
      roomType,
      price,
      season,
      startDate,
      endDate,
      reason,
      user.username
    );
  }

  @Post('apply-session')
  async applySessionPricing(
    @Request() req,
    @Body() body: {
      branch: Branch;
      season: string;
      multiplier: number;
    }
  ) {
    const user = req.user;

    if (user.role !== 'OWNER') {
      throw new ForbiddenException('Only owners can apply session pricing');
    }

    const { branch, season, multiplier } = body;

    if (!branch || !season || !multiplier) {
      throw new BadRequestException('Branch, season, and multiplier are required');
    }

    if (multiplier <= 0) {
      throw new BadRequestException('Multiplier must be greater than 0');
    }

    return this.pricingService.applySessionPricing(
      branch,
      season,
      multiplier,
      user.username
    );
  }

  @Get('suggestions')
  async getPricingSuggestions(
    @Request() req,
    @Query('branch') branch?: Branch
  ) {
    const user = req.user;
    const targetBranch = branch || user.branches?.[0];

    if (user.role !== 'OWNER') {
      throw new ForbiddenException('Only owners can view pricing suggestions');
    }

    if (!targetBranch) {
      throw new BadRequestException('Branch is required');
    }

    return this.pricingService.getPricingSuggestions(targetBranch as Branch);
  }

  @Get('history')
  async getPricingHistory(
    @Request() req,
    @Query('branch') branch?: Branch,
    @Query('roomType') roomType?: string
  ) {
    const user = req.user;
    const targetBranch = branch || user.branches?.[0];

    if (user.role !== 'OWNER') {
      throw new ForbiddenException('Only owners can view pricing history');
    }

    if (!targetBranch) {
      throw new BadRequestException('Branch is required');
    }

    return this.pricingService.getPricingHistory(targetBranch as Branch, roomType);
  }
}