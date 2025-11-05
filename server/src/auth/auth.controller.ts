// auth/auth.controller.ts
import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // 👈 adjust path as needed

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  async login(
    @Req() req: any,
    @Body() body: { username: string; password: string }
  ) {
    // ✅ Pass req so AuthService can log IP, UA, etc.
    return this.auth.login(body.username, body.password, req);
  }

 
  @Post('logout')
  @UseGuards(JwtAuthGuard) // 👈 required so req.user is available
  async logout(@Req() req: any) {
    // ✅ req.user is set by JwtAuthGuard
    await this.auth.logout(req.user, req);
    return { success: true };
  }
}