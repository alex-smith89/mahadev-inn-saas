// server/src/email/email.controller.ts
import { Controller, Post, Body, Logger } from '@nestjs/common';
import { EmailService } from './email.service';

@Controller('email')
export class EmailController {
  private readonly logger = new Logger(EmailController.name);

  constructor(private readonly emailService: EmailService) {}

  @Post('send-booking-confirmation')
  async sendBookingConfirmation(@Body() body: { to: string; booking: any }) {
    try {
      await this.emailService.sendBookingConfirmation(body.to, body.booking);
      return { success: true, message: 'Email sent successfully' };
    } catch (error) {
      this.logger.error(`Error sending email: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @Post('send-booking-request')
  async sendBookingRequest(@Body() body: { to: string; booking: any }) {
    try {
      await this.emailService.sendBookingRequest(body.to, body.booking);
      return { success: true, message: 'Email sent successfully' };
    } catch (error) {
      this.logger.error(`Error sending email: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}