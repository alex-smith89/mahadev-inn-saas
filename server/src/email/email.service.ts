// src/email/email.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    // ✅ Initialize nodemailer transporter
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    this.logger.log('📧 Email service initialized');
  }

  // ✅ Send booking confirmation email
  async sendBookingConfirmation(to: string, booking: any): Promise<void> {
    try {
      this.logger.log(`📧 Sending booking confirmation to: ${to}`);

      const subject = `✅ Booking Confirmation - Mahadev Inn #${booking.bookingNo}`;
      const html = this.generateConfirmationHTML(booking);

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'info@mahadevinn.com',
        to,
        subject,
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`✅ Booking confirmation email sent to ${to}`);
      return info;
    } catch (error) {
      this.logger.error(`❌ Failed to send booking confirmation email: ${error.message}`);
      throw error;
    }
  }

  // ✅ Send booking request email (for pending bookings)
  async sendBookingRequest(to: string, booking: any): Promise<void> {
    try {
      this.logger.log(`📧 Sending booking request to: ${to}`);

      const subject = `📋 Booking Request Received - Mahadev Inn #${booking.bookingNo}`;
      const html = this.generateRequestHTML(booking);

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'info@mahadevinn.com',
        to,
        subject,
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`✅ Booking request email sent to ${to}`);
      return info;
    } catch (error) {
      this.logger.error(`❌ Failed to send booking request email: ${error.message}`);
      throw error;
    }
  }

  // ✅ Send auto check-out email
  async sendAutoCheckoutEmail(to: string, booking: any): Promise<void> {
    try {
      this.logger.log(`📧 Sending auto check-out email to: ${to}`);

      const subject = `📤 Auto Check-out - Mahadev Inn #${booking.bookingNo}`;
      const html = this.generateCheckoutHTML(booking);

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'info@mahadevinn.com',
        to,
        subject,
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`✅ Auto check-out email sent to ${to}`);
      return info;
    } catch (error) {
      this.logger.error(`❌ Failed to send auto check-out email: ${error.message}`);
      throw error;
    }
  }

  // ✅ Send checkout reminder email
  async sendCheckoutReminderEmail(to: string, booking: any): Promise<void> {
    try {
      this.logger.log(`📧 Sending checkout reminder email to: ${to}`);

      const subject = `📅 Checkout Reminder - Mahadev Inn #${booking.bookingNo}`;
      const html = this.generateReminderHTML(booking);

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'info@mahadevinn.com',
        to,
        subject,
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`✅ Checkout reminder email sent to ${to}`);
      return info;
    } catch (error) {
      this.logger.error(`❌ Failed to send checkout reminder email: ${error.message}`);
      throw error;
    }
  }

  // ✅ Generate confirmation email HTML
  private generateConfirmationHTML(booking: any): string {
    const checkInDate = new Date(booking.checkIn).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const checkOutDate = new Date(booking.checkOut).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const currencySymbol = booking.currency === 'INR' ? '₹' : 'Rs.';
    const totalAmount = booking.totalCost || 0;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9fafb;
          }
          .container {
            background-color: #ffffff;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 3px solid #4f46e5;
          }
          .header h1 {
            color: #4f46e5;
            font-size: 28px;
            margin: 0;
          }
          .header p {
            color: #6b7280;
            font-size: 14px;
            margin: 5px 0 0;
          }
          .badge {
            display: inline-block;
            background-color: #22c55e;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin-top: 10px;
          }
          .booking-details {
            margin: 30px 0;
            padding: 20px;
            background-color: #f3f4f6;
            border-radius: 8px;
          }
          .booking-details h2 {
            color: #1f2937;
            font-size: 18px;
            margin-top: 0;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 10px;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: bold;
            color: #4b5563;
          }
          .detail-value {
            color: #1f2937;
          }
          .price-summary {
            margin: 20px 0;
            padding: 20px;
            background-color: #f0fdf4;
            border-radius: 8px;
            border-left: 4px solid #22c55e;
          }
          .price-summary h3 {
            color: #1f2937;
            margin-top: 0;
          }
          .price-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
          }
          .price-total {
            font-size: 18px;
            font-weight: bold;
            color: #4f46e5;
            border-top: 2px solid #e5e7eb;
            padding-top: 10px;
            margin-top: 10px;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
          }
          .contact {
            color: #4f46e5;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏨 MAHADEV INN</h1>
            <p>Booking Confirmation</p>
            <div class="badge">✅ Confirmed</div>
          </div>

          <div class="booking-details">
            <h2>📋 Booking Details</h2>
            <div class="detail-row">
              <span class="detail-label">Booking Number</span>
              <span class="detail-value"><strong>#${booking.bookingNo}</strong></span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Guest Name</span>
              <span class="detail-value">${booking.agentName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Email</span>
              <span class="detail-value">${booking.email}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Contact</span>
              <span class="detail-value">${booking.agentContact}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Branch</span>
              <span class="detail-value">${booking.branch}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Room Type</span>
              <span class="detail-value">${booking.roomType}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Rooms</span>
              <span class="detail-value">${booking.roomsCount}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Meal Plan</span>
              <span class="detail-value">${booking.mealPlan || 'EP'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Check-In</span>
              <span class="detail-value">${checkInDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Check-Out</span>
              <span class="detail-value">${checkOutDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Nights</span>
              <span class="detail-value">${booking.nights || 1}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Heads</span>
              <span class="detail-value">${booking.heads || 1}</span>
            </div>
            ${booking.extraPersons > 0 ? `
            <div class="detail-row">
              <span class="detail-label">Extra Persons</span>
              <span class="detail-value">${booking.extraPersons}</span>
            </div>` : ''}
            ${booking.remark ? `
            <div class="detail-row">
              <span class="detail-label">Remarks</span>
              <span class="detail-value">${booking.remark}</span>
            </div>` : ''}
          </div>

          <div class="price-summary">
            <h3>💰 Price Summary</h3>
            <div class="price-row">
              <span>Room Charge</span>
              <span>${currencySymbol} ${(booking.roomCharges || 0).toLocaleString()}</span>
            </div>
            ${booking.extraPersonCharges > 0 ? `
            <div class="price-row">
              <span>Extra Person Charge</span>
              <span>${currencySymbol} ${(booking.extraPersonCharges || 0).toLocaleString()}</span>
            </div>` : ''}
            ${booking.vatAmount > 0 ? `
            <div class="price-row">
              <span>VAT (${booking.vatRate || 13}%)</span>
              <span>${currencySymbol} ${(booking.vatAmount || 0).toLocaleString()}</span>
            </div>` : ''}
            <div class="price-total">
              <span>Total</span>
              <span>${currencySymbol} ${totalAmount.toLocaleString()}</span>
            </div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 5px;">
              Currency: ${booking.currency || 'NPR'}
            </div>
          </div>

          <div style="text-align: center;">
            <p style="color: #4b5563; font-size: 14px;">
              Thank you for choosing Mahadev Inn. We look forward to welcoming you!
            </p>
            <p style="color: #6b7280; font-size: 12px;">
              📧 ${process.env.EMAIL_FROM || 'info@mahadevinn.com'} | 📱 +977-9800000000
            </p>
          </div>

          <div class="footer">
            <p>This is a system-generated email. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} Mahadev Inn. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // ✅ Generate request email HTML (for pending bookings)
  private generateRequestHTML(booking: any): string {
    const checkInDate = new Date(booking.checkIn).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const checkOutDate = new Date(booking.checkOut).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9fafb;
          }
          .container {
            background-color: #ffffff;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 3px solid #f59e0b;
          }
          .header h1 {
            color: #4f46e5;
            font-size: 28px;
            margin: 0;
          }
          .header p {
            color: #6b7280;
            font-size: 14px;
            margin: 5px 0 0;
          }
          .badge-pending {
            display: inline-block;
            background-color: #f59e0b;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin-top: 10px;
          }
          .booking-details {
            margin: 30px 0;
            padding: 20px;
            background-color: #f3f4f6;
            border-radius: 8px;
          }
          .booking-details h2 {
            color: #1f2937;
            font-size: 18px;
            margin-top: 0;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 10px;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: bold;
            color: #4b5563;
          }
          .detail-value {
            color: #1f2937;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
          }
          .note {
            background-color: #fef3c7;
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
            border-left: 4px solid #f59e0b;
          }
          .note p {
            margin: 0;
            color: #92400e;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏨 MAHADEV INN</h1>
            <p>Booking Request Received</p>
            <div class="badge-pending">⏳ Pending</div>
          </div>

          <div class="note">
            <p>📋 Your booking request has been received. Please wait for confirmation from the hotel.</p>
          </div>

          <div class="booking-details">
            <h2>📋 Booking Details</h2>
            <div class="detail-row">
              <span class="detail-label">Booking Number</span>
              <span class="detail-value"><strong>#${booking.bookingNo}</strong></span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Guest Name</span>
              <span class="detail-value">${booking.agentName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Branch</span>
              <span class="detail-value">${booking.branch}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Room Type</span>
              <span class="detail-value">${booking.roomType}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Check-In</span>
              <span class="detail-value">${checkInDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Check-Out</span>
              <span class="detail-value">${checkOutDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Nights</span>
              <span class="detail-value">${booking.nights || 1}</span>
            </div>
          </div>

          <div style="text-align: center;">
            <p style="color: #6b7280; font-size: 12px;">
              📧 ${process.env.EMAIL_FROM || 'info@mahadevinn.com'} | 📱 +977-9800000000
            </p>
          </div>

          <div class="footer">
            <p>This is a system-generated email. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} Mahadev Inn. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // ✅ Generate checkout email HTML
  private generateCheckoutHTML(booking: any): string {
    const checkInDate = new Date(booking.checkIn).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const checkOutDate = new Date(booking.checkOut).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9fafb;
          }
          .container {
            background-color: #ffffff;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 3px solid #4f46e5;
          }
          .header h1 {
            color: #4f46e5;
            font-size: 28px;
            margin: 0;
          }
          .badge {
            display: inline-block;
            background-color: #22c55e;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin-top: 10px;
          }
          .booking-details {
            margin: 30px 0;
            padding: 20px;
            background-color: #f3f4f6;
            border-radius: 8px;
          }
          .booking-details h2 {
            color: #1f2937;
            font-size: 18px;
            margin-top: 0;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 10px;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: bold;
            color: #4b5563;
          }
          .detail-value {
            color: #1f2937;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
          }
          .checkout-note {
            background-color: #fef2f2;
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
            border-left: 4px solid #ef4444;
          }
          .checkout-note p {
            margin: 0;
            color: #991b1b;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏨 MAHADEV INN</h1>
            <p>Auto Check-out Notification</p>
            <div class="badge">📤 Checked Out</div>
          </div>

          <div class="checkout-note">
            <p>📤 This is to confirm that you have been automatically checked out.</p>
          </div>

          <div class="booking-details">
            <h2>📋 Booking Details</h2>
            <div class="detail-row">
              <span class="detail-label">Booking Number</span>
              <span class="detail-value"><strong>#${booking.bookingNo}</strong></span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Guest Name</span>
              <span class="detail-value">${booking.agentName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Branch</span>
              <span class="detail-value">${booking.branch}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Check-In</span>
              <span class="detail-value">${checkInDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Check-Out</span>
              <span class="detail-value">${checkOutDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Nights</span>
              <span class="detail-value">${booking.nights || 1}</span>
            </div>
          </div>

          <div style="text-align: center;">
            <p style="color: #4b5563; font-size: 14px;">
              Thank you for choosing Mahadev Inn. We hope you enjoyed your stay!
            </p>
            <p style="color: #6b7280; font-size: 12px;">
              📧 ${process.env.EMAIL_FROM || 'info@mahadevinn.com'} | 📱 +977-9800000000
            </p>
          </div>

          <div class="footer">
            <p>This is a system-generated email. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} Mahadev Inn. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // ✅ Generate reminder email HTML
  private generateReminderHTML(booking: any): string {
    const checkInDate = new Date(booking.checkIn).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const checkOutDate = new Date(booking.checkOut).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const daysUntilCheckout = Math.ceil(
      (new Date(booking.checkOut).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9fafb;
          }
          .container {
            background-color: #ffffff;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 3px solid #f59e0b;
          }
          .header h1 {
            color: #4f46e5;
            font-size: 28px;
            margin: 0;
          }
          .badge-reminder {
            display: inline-block;
            background-color: #f59e0b;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin-top: 10px;
          }
          .booking-details {
            margin: 30px 0;
            padding: 20px;
            background-color: #f3f4f6;
            border-radius: 8px;
          }
          .booking-details h2 {
            color: #1f2937;
            font-size: 18px;
            margin-top: 0;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 10px;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: bold;
            color: #4b5563;
          }
          .detail-value {
            color: #1f2937;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
          }
          .reminder-note {
            background-color: #fef3c7;
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
            border-left: 4px solid #f59e0b;
          }
          .reminder-note p {
            margin: 0;
            color: #92400e;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏨 MAHADEV INN</h1>
            <p>Checkout Reminder</p>
            <div class="badge-reminder">📅 ${daysUntilCheckout} Day${daysUntilCheckout > 1 ? 's' : ''} Left</div>
          </div>

          <div class="reminder-note">
            <p>📅 This is a reminder that your checkout is in ${daysUntilCheckout} day${daysUntilCheckout > 1 ? 's' : ''}.</p>
          </div>

          <div class="booking-details">
            <h2>📋 Booking Details</h2>
            <div class="detail-row">
              <span class="detail-label">Booking Number</span>
              <span class="detail-value"><strong>#${booking.bookingNo}</strong></span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Guest Name</span>
              <span class="detail-value">${booking.agentName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Branch</span>
              <span class="detail-value">${booking.branch}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Check-In</span>
              <span class="detail-value">${checkInDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Check-Out</span>
              <span class="detail-value">${checkOutDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Nights</span>
              <span class="detail-value">${booking.nights || 1}</span>
            </div>
          </div>

          <div style="text-align: center;">
            <p style="color: #4b5563; font-size: 14px;">
              Thank you for choosing Mahadev Inn. We hope you are enjoying your stay!
            </p>
            <p style="color: #6b7280; font-size: 12px;">
              📧 ${process.env.EMAIL_FROM || 'info@mahadevinn.com'} | 📱 +977-9800000000
            </p>
          </div>

          <div class="footer">
            <p>This is a system-generated email. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} Mahadev Inn. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}