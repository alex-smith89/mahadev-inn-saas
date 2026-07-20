// src/auth/auth.controller.ts
import { Controller, Post, Body, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Request() req: any, @Body() body: any) {
    return this.authService.login(req, body);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Request() req: any) {
    const user = req.user;
    
    // Call the logout service with audit log
    return this.authService.logout(
      user.id,
      user.username,
      user.selectedBranch || user.branches?.[0] || 'Pokhara',
      req
    );
  }
}