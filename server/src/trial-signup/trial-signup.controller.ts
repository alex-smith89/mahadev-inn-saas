import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { TrialSignupService } from './trial-signup.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('trial-signup')
export class TrialSignupController {
  constructor(private trialSignupService: TrialSignupService) {}

  @Post()
  async create(@Body() data: any) {
    return this.trialSignupService.create(data);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll() {
    return this.trialSignupService.findAll();
  }
}