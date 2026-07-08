// src/email/email.controller.ts
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { EmailService } from './email.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/email')
@UseGuards(JwtAuthGuard)
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('booking-confirmation')
  async sendBookingConfirmation(@Body() body: any) {
    const { email, booking } = body;
    const result = await this.emailService.sendBookingConfirmation(email, booking);
    return { success: result };
  }

  @Post('booking-request')
  async sendBookingRequest(@Body() body: any) {
    const { email, booking } = body;
    const result = await this.emailService.sendBookingRequest(email, booking);
    return { success: result };
  }

  @Post('checkout-reminder')
  async sendCheckoutReminder(@Body() body: any) {
    const { email, guestName, bookingNo, checkOutDate, branch, roomType, daysUntilCheckout } = body;
    const result = await this.emailService.sendCheckoutReminderEmail(
      email,
      guestName,
      bookingNo,
      checkOutDate,
      branch,
      roomType,
      daysUntilCheckout
    );
    return { success: result };
  }

  @Post('auto-checkout')
  async sendAutoCheckout(@Body() body: any) {
    const { email, guestName, bookingNo, branch, roomType } = body;
    const result = await this.emailService.sendAutoCheckoutEmail(
      email,
      guestName,
      bookingNo,
      branch,
      roomType
    );
    return { success: result };
  }
}