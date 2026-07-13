// src/email/email.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private prisma: PrismaService) {
    // Configure email transporter
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  // ✅ Send Booking Request Email
  async sendBookingRequest(to: string, booking: any) {
    try {
      this.logger.log(`📧 Sending booking request to ${to}`);

      const html = this.bookingRequestTemplate(booking);
      const text = this.bookingRequestPlainText(booking);

      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@hotel.com',
        to: to,
        subject: `Booking Request - ${booking.bookingNo}`,
        text: text,
        html: html,
      });

      await this.logEmail(to, 'Booking Request', booking.bookingNo, 'sent');
      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error(`❌ Error sending booking request: ${error.message}`);
      await this.logEmail(to, 'Booking Request', booking.bookingNo, 'failed', error.message);
      return { success: false, error: error.message };
    }
  }

  // ✅ Send Booking Confirmation Email
  async sendBookingConfirmation(to: string, booking: any) {
    try {
      this.logger.log(`📧 Sending booking confirmation to ${to}`);

      const html = this.bookingConfirmationTemplate(booking);
      const text = this.bookingConfirmationPlainText(booking);

      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@hotel.com',
        to: to,
        subject: `Booking Confirmation - ${booking.bookingNo}`,
        text: text,
        html: html,
      });

      await this.logEmail(to, 'Booking Confirmation', booking.bookingNo, 'sent');
      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error(`❌ Error sending booking confirmation: ${error.message}`);
      await this.logEmail(to, 'Booking Confirmation', booking.bookingNo, 'failed', error.message);
      return { success: false, error: error.message };
    }
  }

  // ✅ Send Auto Checkout Email
  async sendAutoCheckoutEmail(to: string, booking: any) {
    try {
      this.logger.log(`📧 Sending auto checkout email to ${to}`);

      const html = this.autoCheckoutTemplate(booking);
      const text = this.autoCheckoutPlainText(booking);

      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@hotel.com',
        to: to,
        subject: `Checkout Confirmation - ${booking.bookingNo}`,
        text: text,
        html: html,
      });

      await this.logEmail(to, 'Auto Checkout', booking.bookingNo, 'sent');
      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error(`❌ Error sending auto checkout email: ${error.message}`);
      await this.logEmail(to, 'Auto Checkout', booking.bookingNo, 'failed', error.message);
      return { success: false, error: error.message };
    }
  }

  // ✅ Send Checkout Reminder Email
  async sendCheckoutReminderEmail(to: string, booking: any) {
    try {
      this.logger.log(`📧 Sending checkout reminder email to ${to}`);

      const checkOutDate = new Date(booking.checkOut);
      const today = new Date();
      const daysUntilCheckout = Math.ceil((checkOutDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      const html = this.checkoutReminderTemplate(booking, daysUntilCheckout);
      const text = this.checkoutReminderPlainText(booking, daysUntilCheckout);

      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@hotel.com',
        to: to,
        subject: `Checkout Reminder - ${booking.bookingNo}`,
        text: text,
        html: html,
      });

      await this.logEmail(to, 'Checkout Reminder', booking.bookingNo, 'sent');
      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error(`❌ Error sending checkout reminder: ${error.message}`);
      await this.logEmail(to, 'Checkout Reminder', booking.bookingNo, 'failed', error.message);
      return { success: false, error: error.message };
    }
  }

  // ✅ Send Generic Email
  async sendEmail(data: {
    to: string;
    subject: string;
    template: string;
    data: any;
    cc?: string[];
    bcc?: string[];
  }) {
    try {
      this.logger.log(`📧 Sending email to ${data.to}: ${data.subject}`);

      const html = this.generateEmailTemplate(data.template, data.data);
      const text = this.generatePlainText(data.template, data.data);

      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@hotel.com',
        to: data.to,
        cc: data.cc,
        bcc: data.bcc,
        subject: data.subject,
        text: text,
        html: html,
      });

      await this.logEmail(data.to, data.template, data.data?.bookingNo || 'N/A', 'sent');
      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error(`❌ Error sending email: ${error.message}`);
      await this.logEmail(data.to, data.template, data.data?.bookingNo || 'N/A', 'failed', error.message);
      return { success: false, error: error.message };
    }
  }

  // ✅ Log Email in Database
  private async logEmail(to: string, template: string, bookingNo: string, status: string, error?: string) {
    try {
      await this.prisma.emailLog.create({
        data: {
          to: to,
          subject: `${template} - ${bookingNo}`,
          template: template,
          data: { bookingNo, status },
          status: status,
          sentAt: new Date(),
          error: error || null,
        },
      });
    } catch (err) {
      this.logger.warn('Could not log email:', err.message);
    }
  }

  // ============================================
  // EMAIL TEMPLATES
  // ============================================

  // ✅ Booking Request Template
  private bookingRequestTemplate(booking: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .status { background: #FFF3E0; border-left: 4px solid #FF9800; padding: 10px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 Booking Request Received</h1>
          </div>
          <div class="content">
            <div class="status">
              <p><strong>Status:</strong> Pending Confirmation</p>
            </div>
            <h2>Dear ${booking.agentName},</h2>
            <p>We have received your booking request. Please find the details below:</p>
            <div class="details">
              <h3>Booking Details:</h3>
              <p><strong>📋 Booking No:</strong> ${booking.bookingNo}</p>
              <p><strong>👤 Guest Name:</strong> ${booking.agentName}</p>
              <p><strong>📅 Check-in:</strong> ${new Date(booking.checkIn).toLocaleDateString()}</p>
              <p><strong>📅 Check-out:</strong> ${new Date(booking.checkOut).toLocaleDateString()}</p>
              <p><strong>🛏️ Room Type:</strong> ${booking.roomType}</p>
              <p><strong>📍 Branch:</strong> ${booking.branch}</p>
              <p><strong>💰 Total Cost:</strong> ${booking.totalCost || 'N/A'} ${booking.currency || 'NPR'}</p>
            </div>
            <p>We will confirm your booking shortly. Please wait for the confirmation email.</p>
            <p>Thank you for choosing us!</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Hotel Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private bookingRequestPlainText(booking: any): string {
    return `
Booking Request Received

Dear ${booking.agentName},

We have received your booking request.

Booking Details:
- Booking No: ${booking.bookingNo}
- Guest Name: ${booking.agentName}
- Check-in: ${new Date(booking.checkIn).toLocaleDateString()}
- Check-out: ${new Date(booking.checkOut).toLocaleDateString()}
- Room Type: ${booking.roomType}
- Branch: ${booking.branch}
- Total Cost: ${booking.totalCost || 'N/A'} ${booking.currency || 'NPR'}

We will confirm your booking shortly.

Thank you for choosing us!
    `;
  }

  // ✅ Booking Confirmation Template
  private bookingConfirmationTemplate(booking: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .success { background: #E8F5E9; border-left: 4px solid #4CAF50; padding: 10px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Booking Confirmed</h1>
          </div>
          <div class="content">
            <div class="success">
              <p><strong>Status:</strong> Confirmed ✅</p>
            </div>
            <h2>Dear ${booking.agentName},</h2>
            <p>Your booking has been confirmed! Please find the details below:</p>
            <div class="details">
              <h3>Booking Details:</h3>
              <p><strong>📋 Booking No:</strong> ${booking.bookingNo}</p>
              <p><strong>👤 Guest Name:</strong> ${booking.agentName}</p>
              <p><strong>📅 Check-in:</strong> ${new Date(booking.checkIn).toLocaleDateString()}</p>
              <p><strong>📅 Check-out:</strong> ${new Date(booking.checkOut).toLocaleDateString()}</p>
              <p><strong>🛏️ Room Type:</strong> ${booking.roomType}</p>
              <p><strong>📍 Branch:</strong> ${booking.branch}</p>
              <p><strong>💰 Total Cost:</strong> ${booking.totalCost || 'N/A'} ${booking.currency || 'NPR'}</p>
            </div>
            <p>We look forward to welcoming you!</p>
            <p>If you have any questions, please don't hesitate to contact us.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Hotel Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private bookingConfirmationPlainText(booking: any): string {
    return `
Booking Confirmed

Dear ${booking.agentName},

Your booking has been confirmed!

Booking Details:
- Booking No: ${booking.bookingNo}
- Guest Name: ${booking.agentName}
- Check-in: ${new Date(booking.checkIn).toLocaleDateString()}
- Check-out: ${new Date(booking.checkOut).toLocaleDateString()}
- Room Type: ${booking.roomType}
- Branch: ${booking.branch}
- Total Cost: ${booking.totalCost || 'N/A'} ${booking.currency || 'NPR'}

We look forward to welcoming you!

Thank you for choosing us!
    `;
  }

  // ✅ Auto Checkout Template
  private autoCheckoutTemplate(booking: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FF9800; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📤 Checkout Confirmation</h1>
          </div>
          <div class="content">
            <h2>Dear ${booking.agentName},</h2>
            <p>Your checkout has been processed successfully.</p>
            <div class="details">
              <h3>Checkout Details:</h3>
              <p><strong>📋 Booking No:</strong> ${booking.bookingNo}</p>
              <p><strong>👤 Guest Name:</strong> ${booking.agentName}</p>
              <p><strong>📅 Checkout Date:</strong> ${new Date(booking.checkOut).toLocaleDateString()}</p>
              <p><strong>📍 Branch:</strong> ${booking.branch}</p>
            </div>
            <p>Thank you for staying with us!</p>
            <p>We hope to see you again soon.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Hotel Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private autoCheckoutPlainText(booking: any): string {
    return `
Checkout Confirmation

Dear ${booking.agentName},

Your checkout has been processed successfully.

Checkout Details:
- Booking No: ${booking.bookingNo}
- Guest Name: ${booking.agentName}
- Checkout Date: ${new Date(booking.checkOut).toLocaleDateString()}
- Branch: ${booking.branch}

Thank you for staying with us!

We hope to see you again soon.
    `;
  }

  // ✅ Checkout Reminder Template
  private checkoutReminderTemplate(booking: any, daysUntilCheckout: number): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FF5722; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .reminder { background: #FFF3E0; border-left: 4px solid #FF5722; padding: 10px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📤 Checkout Reminder</h1>
          </div>
          <div class="content">
            <div class="reminder">
              <p><strong>⚠️ Reminder:</strong> Your checkout is in ${daysUntilCheckout} day${daysUntilCheckout > 1 ? 's' : ''}</p>
            </div>
            <h2>Dear ${booking.agentName},</h2>
            <p>This is a friendly reminder that your checkout is approaching.</p>
            <div class="details">
              <h3>Checkout Details:</h3>
              <p><strong>📋 Booking No:</strong> ${booking.bookingNo}</p>
              <p><strong>👤 Guest Name:</strong> ${booking.agentName}</p>
              <p><strong>📅 Checkout Date:</strong> ${new Date(booking.checkOut).toLocaleDateString()}</p>
              <p><strong>📍 Branch:</strong> ${booking.branch}</p>
            </div>
            <p>Please make sure to:</p>
            <ul>
              <li>Settle any outstanding bills</li>
              <li>Return room keys at the reception</li>
              <li>Check for any personal belongings</li>
            </ul>
            <p>We hope you enjoyed your stay!</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Hotel Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private checkoutReminderPlainText(booking: any, daysUntilCheckout: number): string {
    return `
Checkout Reminder

Dear ${booking.agentName},

This is a friendly reminder that your checkout is in ${daysUntilCheckout} day${daysUntilCheckout > 1 ? 's' : ''}.

Checkout Details:
- Booking No: ${booking.bookingNo}
- Guest Name: ${booking.agentName}
- Checkout Date: ${new Date(booking.checkOut).toLocaleDateString()}
- Branch: ${booking.branch}

Please make sure to:
- Settle any outstanding bills
- Return room keys at the reception
- Check for any personal belongings

We hope you enjoyed your stay!
    `;
  }

  // ✅ Generic Template Generator
  private generateEmailTemplate(template: string, data: any): string {
    switch (template) {
      case 'checkout_reminder':
        return this.checkoutReminderTemplate(data, data.daysUntilCheckout || 1);
      case 'checkin_reminder':
        return this.checkinReminderTemplate(data);
      case 'checkin_confirmation':
        return this.bookingConfirmationTemplate(data);
      case 'manager_checkout_alert':
        return this.managerCheckoutAlertTemplate(data);
      case 'checkout_confirmation':
        return this.autoCheckoutTemplate(data);
      default:
        return this.bookingConfirmationTemplate(data);
    }
  }

  private generatePlainText(template: string, data: any): string {
    switch (template) {
      case 'checkout_reminder':
        return this.checkoutReminderPlainText(data, data.daysUntilCheckout || 1);
      case 'checkin_reminder':
        return this.checkinReminderPlainText(data);
      case 'checkin_confirmation':
        return this.bookingConfirmationPlainText(data);
      case 'manager_checkout_alert':
        return this.managerCheckoutAlertPlainText(data);
      case 'checkout_confirmation':
        return this.autoCheckoutPlainText(data);
      default:
        return this.bookingConfirmationPlainText(data);
    }
  }

  // ✅ Checkin Reminder Template
  private checkinReminderTemplate(data: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📅 Check-in Reminder</h1>
          </div>
          <div class="content">
            <h2>Dear ${data.guestName},</h2>
            <p>This is a reminder that your check-in is scheduled for <strong>tomorrow</strong>.</p>
            <div class="details">
              <h3>Check-in Details:</h3>
              <p><strong>📋 Booking No:</strong> ${data.bookingNo}</p>
              <p><strong>📅 Date:</strong> ${new Date(data.checkInDate).toLocaleDateString()}</p>
              <p><strong>📍 Branch:</strong> ${data.branch}</p>
            </div>
            <p>We look forward to welcoming you!</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Hotel Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private checkinReminderPlainText(data: any): string {
    return `
Check-in Reminder

Dear ${data.guestName},

This is a reminder that your check-in is scheduled for tomorrow.

Check-in Details:
- Booking No: ${data.bookingNo}
- Date: ${new Date(data.checkInDate).toLocaleDateString()}
- Branch: ${data.branch}

We look forward to welcoming you!
    `;
  }

  // ✅ Manager Checkout Alert Template
  private managerCheckoutAlertTemplate(data: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FF9800; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .alert { background: #FFF3E0; border-left: 4px solid #FF9800; padding: 10px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 Room Vacating Alert</h1>
          </div>
          <div class="content">
            <div class="alert">
              <p><strong>⚠️ Guest Checkout Alert</strong></p>
            </div>
            <h2>Dear Manager,</h2>
            <p>A guest will be checking out soon. Please ensure proper procedures are followed.</p>
            <div class="details">
              <h3>Guest Details:</h3>
              <p><strong>👤 Guest Name:</strong> ${data.guestName}</p>
              <p><strong>📋 Booking No:</strong> ${data.bookingNo}</p>
              <p><strong>📅 Check-out Date:</strong> ${new Date(data.checkOutDate).toLocaleDateString()}</p>
              <p><strong>⏳ Days until checkout:</strong> ${data.daysUntilCheckout} day${data.daysUntilCheckout > 1 ? 's' : ''}</p>
              <p><strong>📍 Branch:</strong> ${data.branch}</p>
            </div>
            <p><strong>Action Required:</strong></p>
            <ul>
              <li>Prepare the room for housekeeping</li>
              <li>Verify any pending charges</li>
              <li>Prepare checkout documents</li>
              <li>Ensure room keys are returned</li>
            </ul>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Hotel Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private managerCheckoutAlertPlainText(data: any): string {
    return `
Room Vacating Alert

Dear Manager,

A guest will be checking out soon.

Guest Details:
- Guest Name: ${data.guestName}
- Booking No: ${data.bookingNo}
- Check-out Date: ${new Date(data.checkOutDate).toLocaleDateString()}
- Days until checkout: ${data.daysUntilCheckout} day${data.daysUntilCheckout > 1 ? 's' : ''}
- Branch: ${data.branch}

Action Required:
- Prepare the room for housekeeping
- Verify any pending charges
- Prepare checkout documents
- Ensure room keys are returned
    `;
  }
}