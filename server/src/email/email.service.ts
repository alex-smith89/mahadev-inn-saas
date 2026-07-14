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

      // ✅ Ensure proper data mapping for templates
      const emailData = {
        guestName: data.data?.guestName || data.data?.agentName || 'Guest',
        bookingNo: data.data?.bookingNo || 'N/A',
        checkInDate: data.data?.checkInDate || data.data?.checkIn || null,
        checkOutDate: data.data?.checkOutDate || data.data?.checkOut || null,
        branch: data.data?.branch || 'N/A',
        roomType: data.data?.roomType || 'N/A',
        totalCost: data.data?.totalCost || null,
        daysUntilCheckout: data.data?.daysUntilCheckout || 0,
        timeUntilCheckout: data.data?.timeUntilCheckout || '',
        agentName: data.data?.agentName || 'Guest',
      };

      const html = this.generateEmailTemplate(data.template, emailData);
      const text = this.generatePlainText(data.template, emailData);

      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@hotel.com',
        to: data.to,
        cc: data.cc,
        bcc: data.bcc,
        subject: data.subject,
        text: text,
        html: html,
      });

      await this.logEmail(data.to, data.template, emailData.bookingNo, 'sent');
      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error(`❌ Error sending email: ${error.message}`);
      await this.logEmail(data.to, data.template, 'N/A', 'failed', error.message);
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
  // EMAIL TEMPLATES - WITH PROPER DATA HANDLING
  // ============================================

  // ✅ Booking Request Template
  private bookingRequestTemplate(booking: any): string {
    const guestName = booking.agentName || booking.guestName || 'Guest';
    const checkInDate = booking.checkIn ? new Date(booking.checkIn) : null;
    const checkOutDate = booking.checkOut ? new Date(booking.checkOut) : null;
    const checkInStr = checkInDate ? this.formatDateWithTime(checkInDate, false) : 'Not specified';
    const checkOutStr = checkOutDate ? this.formatDateWithTime(checkOutDate, true) : 'Not specified';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2196F3; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; background: #f1f1f1; border-radius: 0 0 8px 8px; }
          .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .status { background: #FFF3E0; border-left: 4px solid #FF9800; padding: 10px; margin: 10px 0; }
          .label { font-weight: bold; color: #555; }
          .highlight { color: #2196F3; font-weight: bold; }
          .divider { border-top: 1px solid #e0e0e0; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">📋 Booking Request Received</h1>
          </div>
          <div class="content">
            <div class="status">
              <p><strong>Status:</strong> Pending Confirmation ⏳</p>
            </div>
            <h2>Dear ${guestName},</h2>
            <p>We have received your booking request. Please find the details below:</p>
            <div class="details">
              <h3 style="margin-top: 0;">📋 Booking Details:</h3>
              <p><span class="label">📋 Booking No:</span> <strong>${booking.bookingNo || 'N/A'}</strong></p>
              <p><span class="label">👤 Guest Name:</span> <strong>${guestName}</strong></p>
              <p><span class="label">📅 Check-in:</span> <span class="highlight">${checkInStr}</span></p>
              <p><span class="label">📅 Check-out:</span> <span class="highlight">${checkOutStr}</span></p>
              <p><span class="label">🛏️ Room Type:</span> <strong>${booking.roomType || 'N/A'}</strong></p>
              <p><span class="label">📍 Branch:</span> <strong>${booking.branch || 'N/A'}</strong></p>
              <p><span class="label">💰 Total Cost:</span> <strong>${booking.totalCost ? `Rs. ${booking.totalCost}` : 'N/A'}</strong></p>
            </div>
            <p>We will confirm your booking shortly. Please wait for the confirmation email.</p>
            <div class="divider"></div>
            <p style="font-size: 14px; color: #666;">Thank you for choosing us!</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Hotel Management System. All rights reserved.</p>
            <p style="font-size: 10px; color: #999;">This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private bookingRequestPlainText(booking: any): string {
    const guestName = booking.agentName || booking.guestName || 'Guest';
    const checkInDate = booking.checkIn ? new Date(booking.checkIn) : null;
    const checkOutDate = booking.checkOut ? new Date(booking.checkOut) : null;
    const checkInStr = checkInDate ? this.formatDateWithTimePlain(checkInDate, false) : 'Not specified';
    const checkOutStr = checkOutDate ? this.formatDateWithTimePlain(checkOutDate, true) : 'Not specified';

    return `
Booking Request Received

Dear ${guestName},

We have received your booking request.

Booking Details:
- Booking No: ${booking.bookingNo || 'N/A'}
- Guest Name: ${guestName}
- Check-in: ${checkInStr}
- Check-out: ${checkOutStr}
- Room Type: ${booking.roomType || 'N/A'}
- Branch: ${booking.branch || 'N/A'}
- Total Cost: ${booking.totalCost ? `Rs. ${booking.totalCost}` : 'N/A'}

We will confirm your booking shortly.

Thank you for choosing us!
    `;
  }

  // ✅ Booking Confirmation Template
  private bookingConfirmationTemplate(booking: any): string {
    const guestName = booking.agentName || booking.guestName || booking.name || 'Guest';
    
    // Handle date objects properly
    let checkInDate = this.extractDate(booking, 'checkIn');
    let checkOutDate = this.extractDate(booking, 'checkOut');
    
    // ✅ Pass true for check-out to force 12:00 PM
    const checkInStr = checkInDate ? this.formatDateWithTime(checkInDate, false) : 'Not specified';
    const checkOutStr = checkOutDate ? this.formatDateWithTime(checkOutDate, true) : 'Not specified';
    
    // Calculate stay duration
    let stayDuration = 'N/A';
    if (checkInDate && checkOutDate) {
      const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
      stayDuration = `${nights} night${nights > 1 ? 's' : ''}`;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; background: #f1f1f1; border-radius: 0 0 8px 8px; }
          .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .success { background: #E8F5E9; border-left: 4px solid #4CAF50; padding: 10px; margin: 10px 0; }
          .label { font-weight: bold; color: #555; }
          .highlight { color: #4CAF50; font-weight: bold; }
          .stay-badge { background: #4CAF50; color: white; padding: 4px 12px; border-radius: 20px; display: inline-block; font-size: 14px; }
          .info-box { background: #E3F2FD; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #2196F3; }
          .divider { border-top: 1px solid #e0e0e0; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">✅ Booking Confirmed</h1>
          </div>
          <div class="content">
            <div class="success">
              <p><strong>Status:</strong> Confirmed ✅</p>
            </div>
            <h2>Dear ${guestName},</h2>
            <p>Your booking has been confirmed! Please find the details below:</p>
            <div class="details">
              <h3 style="margin-top: 0;">📋 Booking Details:</h3>
              <p><span class="label">📋 Booking No:</span> <strong>${booking.bookingNo || 'N/A'}</strong></p>
              <p><span class="label">👤 Guest Name:</span> <strong>${guestName}</strong></p>
              <p><span class="label">📅 Check-in:</span> <span class="highlight">${checkInStr}</span></p>
              <p><span class="label">📅 Check-out:</span> <span class="highlight">${checkOutStr}</span></p>
              <p><span class="label">⏳ Stay Duration:</span> <span class="stay-badge">${stayDuration}</span></p>
              <p><span class="label">🛏️ Room Type:</span> <strong>${booking.roomType || 'N/A'}</strong></p>
              <p><span class="label">📍 Branch:</span> <strong>${booking.branch || 'N/A'}</strong></p>
              <p><span class="label">💰 Total Cost:</span> <strong>${booking.totalCost ? `Rs. ${booking.totalCost}` : 'N/A'}</strong></p>
            </div>
            <div class="info-box">
              <p style="font-weight: bold; margin-bottom: 5px;">📌 Important Information:</p>
              <ul style="margin: 5px 0;">
                <li>Please carry a valid ID proof</li>
                <li>Check-in time: 12:00 PM</li>
                <li>Check-out time: 12:00 PM</li>
              </ul>
            </div>
            <p>We look forward to welcoming you!</p>
            <div class="divider"></div>
            <p style="font-size: 14px; color: #666;">If you have any questions, please don't hesitate to contact us.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Hotel Management System. All rights reserved.</p>
            <p style="font-size: 10px; color: #999;">This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private bookingConfirmationPlainText(booking: any): string {
    const guestName = booking.agentName || booking.guestName || booking.name || 'Guest';
    
    let checkInDate = this.extractDate(booking, 'checkIn');
    let checkOutDate = this.extractDate(booking, 'checkOut');
    
    const checkInStr = checkInDate ? this.formatDateWithTimePlain(checkInDate, false) : 'Not specified';
    const checkOutStr = checkOutDate ? this.formatDateWithTimePlain(checkOutDate, true) : 'Not specified';

    return `
Booking Confirmed

Dear ${guestName},

Your booking has been confirmed!

Booking Details:
- Booking No: ${booking.bookingNo || 'N/A'}
- Guest Name: ${guestName}
- Check-in: ${checkInStr}
- Check-out: ${checkOutStr}
- Room Type: ${booking.roomType || 'N/A'}
- Branch: ${booking.branch || 'N/A'}
- Total Cost: ${booking.totalCost ? `Rs. ${booking.totalCost}` : 'N/A'}

Important Information:
- Please carry a valid ID proof
- Check-in time: 12:00 PM
- Check-out time: 12:00 PM

We look forward to welcoming you!

Thank you for choosing us!
    `;
  }

  // ✅ Auto Checkout Template
  private autoCheckoutTemplate(booking: any): string {
    const guestName = booking.agentName || booking.guestName || 'Guest';
    const checkOutDate = this.extractDate(booking, 'checkOut');
    // ✅ Pass true for check-out to force 12:00 PM
    const checkOutStr = checkOutDate ? this.formatDateWithTime(checkOutDate, true) : 'Not specified';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FF9800; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; background: #f1f1f1; border-radius: 0 0 8px 8px; }
          .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .label { font-weight: bold; color: #555; }
          .highlight { color: #FF9800; font-weight: bold; }
          .divider { border-top: 1px solid #e0e0e0; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">📤 Checkout Confirmation</h1>
          </div>
          <div class="content">
            <h2>Dear ${guestName},</h2>
            <p>Your checkout has been processed successfully.</p>
            <div class="details">
              <h3 style="margin-top: 0;">📋 Checkout Details:</h3>
              <p><span class="label">📋 Booking No:</span> <strong>${booking.bookingNo || 'N/A'}</strong></p>
              <p><span class="label">👤 Guest Name:</span> <strong>${guestName}</strong></p>
              <p><span class="label">📅 Checkout Date:</span> <span class="highlight">${checkOutStr}</span></p>
              <p><span class="label">📍 Branch:</span> <strong>${booking.branch || 'N/A'}</strong></p>
            </div>
            <p>Thank you for staying with us!</p>
            <div class="divider"></div>
            <p style="font-size: 14px; color: #666;">We hope to see you again soon.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Hotel Management System. All rights reserved.</p>
            <p style="font-size: 10px; color: #999;">This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private autoCheckoutPlainText(booking: any): string {
    const guestName = booking.agentName || booking.guestName || 'Guest';
    const checkOutDate = this.extractDate(booking, 'checkOut');
    const checkOutStr = checkOutDate ? this.formatDateWithTimePlain(checkOutDate, true) : 'Not specified';

    return `
Checkout Confirmation

Dear ${guestName},

Your checkout has been processed successfully.

Checkout Details:
- Booking No: ${booking.bookingNo || 'N/A'}
- Guest Name: ${guestName}
- Checkout Date: ${checkOutStr}
- Branch: ${booking.branch || 'N/A'}

Thank you for staying with us!

We hope to see you again soon.
    `;
  }

  // ✅ Checkout Reminder Template - With Time Until Checkout
  private checkoutReminderTemplate(booking: any, daysUntilCheckout: number): string {
    const guestName = booking.agentName || booking.guestName || booking.name || 'Guest';
    
    let checkInDate = this.extractDate(booking, 'checkIn');
    let checkOutDate = this.extractDate(booking, 'checkOut');
    
    // ✅ Pass true for check-out to force 12:00 PM
    const checkInStr = checkInDate ? this.formatDateWithTime(checkInDate, false) : 'Not specified';
    const checkOutStr = checkOutDate ? this.formatDateWithTime(checkOutDate, true) : 'Not specified';
    
    // Calculate time until checkout
    let timeUntilCheckout = 'N/A';
    if (checkOutDate) {
      const now = new Date();
      const diffMs = checkOutDate.getTime() - now.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      if (daysUntilCheckout > 0) {
        timeUntilCheckout = `${daysUntilCheckout} day${daysUntilCheckout > 1 ? 's' : ''}`;
        if (diffHours % 24 > 0) {
          timeUntilCheckout += ` and ${diffHours % 24} hour${diffHours % 24 > 1 ? 's' : ''}`;
        }
      } else if (diffHours > 0) {
        timeUntilCheckout = `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
        if (diffMinutes > 0) {
          timeUntilCheckout += ` and ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
        }
      } else if (diffMinutes > 0) {
        timeUntilCheckout = `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
      } else {
        timeUntilCheckout = 'very soon';
      }
    }

    const dayText = daysUntilCheckout === 1 ? 'tomorrow' : `in ${daysUntilCheckout} days`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FF5722; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; background: #f1f1f1; border-radius: 0 0 8px 8px; }
          .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .reminder { background: #FFF3E0; border-left: 4px solid #FF5722; padding: 10px; margin: 10px 0; }
          .label { font-weight: bold; color: #555; }
          .highlight { color: #FF5722; font-weight: bold; }
          .time-badge { background: #FF5722; color: white; padding: 4px 12px; border-radius: 20px; display: inline-block; font-size: 14px; }
          .action-box { background: #FFF8E1; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #FFC107; }
          .divider { border-top: 1px solid #e0e0e0; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">📤 Checkout Reminder</h1>
          </div>
          <div class="content">
            <div class="reminder">
              <p><strong>⚠️ Reminder:</strong> Your checkout is ${dayText}</p>
              <p style="margin-top: 5px;">
                <span class="time-badge">⏰ ${timeUntilCheckout} remaining</span>
              </p>
            </div>
            <h2>Dear ${guestName},</h2>
            <p>This is a friendly reminder that your checkout is approaching.</p>
            <div class="details">
              <h3 style="margin-top: 0;">📋 Booking Details:</h3>
              <p><span class="label">📋 Booking No:</span> <strong>${booking.bookingNo || 'N/A'}</strong></p>
              <p><span class="label">👤 Guest Name:</span> <strong>${guestName}</strong></p>
              <p><span class="label">📅 Check-in Date:</span> ${checkInStr}</p>
              <p><span class="label">📅 Check-out Date:</span> <span class="highlight">${checkOutStr}</span></p>
              <p><span class="label">🛏️ Room Type:</span> <strong>${booking.roomType || 'N/A'}</strong></p>
              <p><span class="label">📍 Branch:</span> <strong>${booking.branch || 'N/A'}</strong></p>
            </div>
            <div class="action-box">
              <p style="font-weight: bold; margin-bottom: 5px;">📌 Please make sure to:</p>
              <ul style="margin: 5px 0;">
                <li>Settle any outstanding bills</li>
                <li>Return room keys at the reception</li>
                <li>Check for any personal belongings</li>
              </ul>
            </div>
            <p>We hope you enjoyed your stay!</p>
            <div class="divider"></div>
            <p style="font-size: 14px; color: #666;">Thank you for choosing us.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Hotel Management System. All rights reserved.</p>
            <p style="font-size: 10px; color: #999;">This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private checkoutReminderPlainText(booking: any, daysUntilCheckout: number): string {
    const guestName = booking.agentName || booking.guestName || booking.name || 'Guest';
    
    let checkInDate = this.extractDate(booking, 'checkIn');
    let checkOutDate = this.extractDate(booking, 'checkOut');
    
    const checkInStr = checkInDate ? this.formatDateWithTimePlain(checkInDate, false) : 'Not specified';
    const checkOutStr = checkOutDate ? this.formatDateWithTimePlain(checkOutDate, true) : 'Not specified';
    
    // Calculate time until checkout
    let timeUntilCheckout = 'N/A';
    if (checkOutDate) {
      const now = new Date();
      const diffMs = checkOutDate.getTime() - now.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      if (daysUntilCheckout > 0) {
        timeUntilCheckout = `${daysUntilCheckout} day${daysUntilCheckout > 1 ? 's' : ''}`;
        if (diffHours % 24 > 0) {
          timeUntilCheckout += ` and ${diffHours % 24} hour${diffHours % 24 > 1 ? 's' : ''}`;
        }
      } else if (diffHours > 0) {
        timeUntilCheckout = `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
        if (diffMinutes > 0) {
          timeUntilCheckout += ` and ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
        }
      } else if (diffMinutes > 0) {
        timeUntilCheckout = `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
      } else {
        timeUntilCheckout = 'very soon';
      }
    }

    const dayText = daysUntilCheckout === 1 ? 'tomorrow' : `in ${daysUntilCheckout} days`;

    return `
Checkout Reminder

Dear ${guestName},

This is a friendly reminder that your checkout is ${dayText}.

⏰ Time remaining: ${timeUntilCheckout}

Booking Details:
- Booking No: ${booking.bookingNo || 'N/A'}
- Guest Name: ${guestName}
- Check-in Date: ${checkInStr}
- Check-out Date: ${checkOutStr}
- Room Type: ${booking.roomType || 'N/A'}
- Branch: ${booking.branch || 'N/A'}

Please make sure to:
- Settle any outstanding bills
- Return room keys at the reception
- Check for any personal belongings

We hope you enjoyed your stay!

Thank you for choosing us.
    `;
  }

  // ✅ Checkin Reminder Template
  private checkinReminderTemplate(data: any): string {
    const guestName = data.guestName || data.agentName || 'Guest';
    const checkInDate = this.extractDate(data, 'checkInDate') || this.extractDate(data, 'checkIn');
    const checkInStr = checkInDate ? this.formatDateWithTime(checkInDate, false) : 'Not specified';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2196F3; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; background: #f1f1f1; border-radius: 0 0 8px 8px; }
          .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .label { font-weight: bold; color: #555; }
          .highlight { color: #2196F3; font-weight: bold; }
          .info-box { background: #E3F2FD; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #2196F3; }
          .divider { border-top: 1px solid #e0e0e0; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">📅 Check-in Reminder</h1>
          </div>
          <div class="content">
            <h2>Dear ${guestName},</h2>
            <p>This is a reminder that your check-in is scheduled for <strong>tomorrow</strong>.</p>
            <div class="details">
              <h3 style="margin-top: 0;">📋 Check-in Details:</h3>
              <p><span class="label">📋 Booking No:</span> <strong>${data.bookingNo || 'N/A'}</strong></p>
              <p><span class="label">👤 Guest Name:</span> <strong>${guestName}</strong></p>
              <p><span class="label">📅 Date:</span> <span class="highlight">${checkInStr}</span></p>
              <p><span class="label">📍 Branch:</span> <strong>${data.branch || 'N/A'}</strong></p>
            </div>
            <div class="info-box">
              <p style="font-weight: bold; margin-bottom: 5px;">📌 Please remember:</p>
              <ul style="margin: 5px 0;">
                <li>Carry a valid ID proof</li>
                <li>Check-in time: 12:00 PM</li>
              </ul>
            </div>
            <p>We look forward to welcoming you!</p>
            <div class="divider"></div>
            <p style="font-size: 14px; color: #666;">Please arrive on time for a smooth check-in experience.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Hotel Management System. All rights reserved.</p>
            <p style="font-size: 10px; color: #999;">This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private checkinReminderPlainText(data: any): string {
    const guestName = data.guestName || data.agentName || 'Guest';
    const checkInDate = this.extractDate(data, 'checkInDate') || this.extractDate(data, 'checkIn');
    const checkInStr = checkInDate ? this.formatDateWithTimePlain(checkInDate, false) : 'Not specified';

    return `
Check-in Reminder

Dear ${guestName},

This is a reminder that your check-in is scheduled for tomorrow.

Check-in Details:
- Booking No: ${data.bookingNo || 'N/A'}
- Guest Name: ${guestName}
- Date: ${checkInStr}
- Branch: ${data.branch || 'N/A'}

Please remember:
- Carry a valid ID proof
- Check-in time: 12:00 PM

We look forward to welcoming you!
    `;
  }

  // ✅ Manager Checkout Alert Template
  private managerCheckoutAlertTemplate(data: any): string {
    const guestName = data.guestName || data.agentName || 'Guest';
    const checkOutDate = this.extractDate(data, 'checkOutDate') || this.extractDate(data, 'checkOut');
    // ✅ Pass true for check-out to force 12:00 PM
    const checkOutStr = checkOutDate ? this.formatDateWithTime(checkOutDate, true) : 'Not specified';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FF9800; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; background: #f1f1f1; border-radius: 0 0 8px 8px; }
          .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .alert { background: #FFF3E0; border-left: 4px solid #FF9800; padding: 10px; margin: 10px 0; }
          .label { font-weight: bold; color: #555; }
          .highlight { color: #FF9800; font-weight: bold; }
          .action-box { background: #FFF8E1; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #FFC107; }
          .divider { border-top: 1px solid #e0e0e0; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">📋 Room Vacating Alert</h1>
          </div>
          <div class="content">
            <div class="alert">
              <p><strong>⚠️ Guest Checkout Alert</strong></p>
            </div>
            <h2>Dear Manager,</h2>
            <p>A guest will be checking out soon. Please ensure proper procedures are followed.</p>
            <div class="details">
              <h3 style="margin-top: 0;">👤 Guest Details:</h3>
              <p><span class="label">👤 Guest Name:</span> <strong>${guestName}</strong></p>
              <p><span class="label">📋 Booking No:</span> <strong>${data.bookingNo || 'N/A'}</strong></p>
              <p><span class="label">📅 Check-out Date:</span> <span class="highlight">${checkOutStr}</span></p>
              <p><span class="label">⏳ Days until checkout:</span> <strong>${data.daysUntilCheckout || 0} day${data.daysUntilCheckout > 1 ? 's' : ''}</strong></p>
              <p><span class="label">📍 Branch:</span> <strong>${data.branch || 'N/A'}</strong></p>
            </div>
            <div class="action-box">
              <p style="font-weight: bold; margin-bottom: 5px;">📌 Action Required:</p>
              <ul style="margin: 5px 0;">
                <li>Prepare the room for housekeeping</li>
                <li>Verify any pending charges</li>
                <li>Prepare checkout documents</li>
                <li>Ensure room keys are returned</li>
              </ul>
            </div>
            <div class="divider"></div>
            <p style="font-size: 12px; color: #666;">This is an automated notification from the Hotel Management System.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Hotel Management System. All rights reserved.</p>
            <p style="font-size: 10px; color: #999;">This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private managerCheckoutAlertPlainText(data: any): string {
    const guestName = data.guestName || data.agentName || 'Guest';
    const checkOutDate = this.extractDate(data, 'checkOutDate') || this.extractDate(data, 'checkOut');
    const checkOutStr = checkOutDate ? this.formatDateWithTimePlain(checkOutDate, true) : 'Not specified';

    return `
Room Vacating Alert

Dear Manager,

A guest will be checking out soon.

Guest Details:
- Guest Name: ${guestName}
- Booking No: ${data.bookingNo || 'N/A'}
- Check-out Date: ${checkOutStr}
- Days until checkout: ${data.daysUntilCheckout || 0} day${data.daysUntilCheckout > 1 ? 's' : ''}
- Branch: ${data.branch || 'N/A'}

Action Required:
- Prepare the room for housekeeping
- Verify any pending charges
- Prepare checkout documents
- Ensure room keys are returned

This is an automated notification from the Hotel Management System.
    `;
  }

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  // ✅ Extract date from booking object
  private extractDate(booking: any, field: string): Date | null {
    if (!booking) return null;
    
    // Try multiple field names
    const possibleFields = [field, `${field}Date`, `${field}_date`];
    
    for (const f of possibleFields) {
      if (booking[f]) {
        const date = booking[f] instanceof Date ? booking[f] : new Date(booking[f]);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
    
    return null;
  }

  // ✅ Format date with time for HTML emails
  // isCheckOut: true = force 12:00 PM for check-out dates
  // isCheckOut: false = show actual time for check-in dates
  private formatDateWithTime(date: Date, isCheckOut: boolean = false): string {
    if (!date || isNaN(date.getTime())) return 'Not specified';
    
    const dateStr = date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
    
    // ✅ For check-out dates, always show 12:00 PM
    if (isCheckOut) {
      return `${dateStr} at 12:00 PM`;
    }
    
    // For check-in dates, show actual time if available
    const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
    if (hasTime) {
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      return `${dateStr} at ${timeStr}`;
    }
    
    return dateStr;
  }

  // ✅ Format date with time for plain text emails
  // isCheckOut: true = force 12:00 PM for check-out dates
  // isCheckOut: false = show actual time for check-in dates
  private formatDateWithTimePlain(date: Date, isCheckOut: boolean = false): string {
    if (!date || isNaN(date.getTime())) return 'Not specified';
    
    const dateStr = date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
    
    // ✅ For check-out dates, always show 12:00 PM
    if (isCheckOut) {
      return `${dateStr} at 12:00 PM`;
    }
    
    // For check-in dates, show actual time if available
    const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
    if (hasTime) {
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      return `${dateStr} at ${timeStr}`;
    }
    
    return dateStr;
  }

  // ✅ Generic Template Generator
  private generateEmailTemplate(template: string, data: any): string {
    // Ensure data has all required fields
    const emailData = {
      guestName: data.guestName || 'Guest',
      bookingNo: data.bookingNo || 'N/A',
      checkInDate: data.checkInDate || null,
      checkOutDate: data.checkOutDate || null,
      branch: data.branch || 'N/A',
      roomType: data.roomType || 'N/A',
      totalCost: data.totalCost || null,
      daysUntilCheckout: data.daysUntilCheckout || 0,
      timeUntilCheckout: data.timeUntilCheckout || '',
      agentName: data.agentName || 'Guest',
    };

    switch (template) {
      case 'checkout_reminder':
        return this.checkoutReminderTemplate(emailData, emailData.daysUntilCheckout);
      case 'checkin_reminder':
        return this.checkinReminderTemplate(emailData);
      case 'checkin_confirmation':
        return this.bookingConfirmationTemplate(emailData);
      case 'manager_checkout_alert':
        return this.managerCheckoutAlertTemplate(emailData);
      case 'checkout_confirmation':
        return this.autoCheckoutTemplate(emailData);
      default:
        return this.bookingConfirmationTemplate(emailData);
    }
  }

  private generatePlainText(template: string, data: any): string {
    const emailData = {
      guestName: data.guestName || 'Guest',
      bookingNo: data.bookingNo || 'N/A',
      checkInDate: data.checkInDate || null,
      checkOutDate: data.checkOutDate || null,
      branch: data.branch || 'N/A',
      roomType: data.roomType || 'N/A',
      totalCost: data.totalCost || null,
      daysUntilCheckout: data.daysUntilCheckout || 0,
      timeUntilCheckout: data.timeUntilCheckout || '',
      agentName: data.agentName || 'Guest',
    };

    switch (template) {
      case 'checkout_reminder':
        return this.checkoutReminderPlainText(emailData, emailData.daysUntilCheckout);
      case 'checkin_reminder':
        return this.checkinReminderPlainText(emailData);
      case 'checkin_confirmation':
        return this.bookingConfirmationPlainText(emailData);
      case 'manager_checkout_alert':
        return this.managerCheckoutAlertPlainText(emailData);
      case 'checkout_confirmation':
        return this.autoCheckoutPlainText(emailData);
      default:
        return this.bookingConfirmationPlainText(emailData);
    }
  }
}