// src/email/email.service.ts
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'your-email@gmail.com',
        pass: process.env.SMTP_PASSWORD || 'your-app-password',
      },
    });
  }

  // ✅ Send booking confirmation email
  async sendBookingConfirmation(email: string, booking: any) {
    const subject = `✅ Booking Confirmed - ${booking.bookingNo}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa; border-radius: 10px;">
        <div style="text-align: center; padding: 20px; background: #4f46e5; border-radius: 10px 10px 0 0; color: white;">
          <h1 style="margin: 0;">🏨 MAHADEV INN</h1>
          <p style="margin: 5px 0 0; opacity: 0.8;">Booking Confirmation</p>
        </div>
        <div style="padding: 30px; background: white; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Dear ${booking.agentName},</h2>
          <p style="color: #555; line-height: 1.6;">Thank you for choosing Mahadev Inn! Your booking has been confirmed successfully.</p>
          
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px; color: #4f46e5;">Booking Details</h3>
            <p style="margin: 5px 0;"><strong>Booking No:</strong> ${booking.bookingNo}</p>
            <p style="margin: 5px 0;"><strong>Guest Name:</strong> ${booking.agentName}</p>
            <p style="margin: 5px 0;"><strong>Check-In:</strong> ${new Date(booking.checkIn).toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>Check-Out:</strong> ${new Date(booking.checkOut).toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>Room Type:</strong> ${booking.roomType}</p>
            <p style="margin: 5px 0;"><strong>Number of Rooms:</strong> ${booking.roomsCount}</p>
            <p style="margin: 5px 0;"><strong>Meal Plan:</strong> ${booking.mealPlan}</p>
            <p style="margin: 5px 0;"><strong>Branch:</strong> ${booking.branch}</p>
          </div>

          <p style="color: #555; line-height: 1.6;">We look forward to welcoming you!</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
            <p style="margin: 0;"><strong>Mahadev Inn Hotel Management</strong></p>
            <p style="margin: 5px 0 0;">© ${new Date().getFullYear()} All rights reserved</p>
          </div>
        </div>
      </div>
    `;

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM || 'Mahadev Inn <noreply@mahadevinn.com>',
      to: email,
      subject: subject,
      html: html,
    });

    console.log(`✅ Booking confirmation email sent to ${email} for booking ${booking.bookingNo}`);
    return true;
  }

  // ✅ Send booking request (pending) email
  async sendBookingRequest(email: string, booking: any) {
    const subject = `⏳ Booking Request Received - ${booking.bookingNo}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa; border-radius: 10px;">
        <div style="text-align: center; padding: 20px; background: #f59e0b; border-radius: 10px 10px 0 0; color: white;">
          <h1 style="margin: 0;">🏨 MAHADEV INN</h1>
          <p style="margin: 5px 0 0; opacity: 0.8;">Booking Request Received</p>
        </div>
        <div style="padding: 30px; background: white; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Dear ${booking.agentName},</h2>
          <p style="color: #555; line-height: 1.6;">Your booking request has been received and is currently under review.</p>
          
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="margin: 0 0 10px; color: #92400e;">Booking Details</h3>
            <p style="margin: 5px 0;"><strong>Booking No:</strong> ${booking.bookingNo}</p>
            <p style="margin: 5px 0;"><strong>Guest Name:</strong> ${booking.agentName}</p>
            <p style="margin: 5px 0;"><strong>Check-In:</strong> ${new Date(booking.checkIn).toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>Check-Out:</strong> ${new Date(booking.checkOut).toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>Room Type:</strong> ${booking.roomType}</p>
            <p style="margin: 5px 0;"><strong>Number of Rooms:</strong> ${booking.roomsCount}</p>
            <p style="margin: 5px 0;"><strong>Branch:</strong> ${booking.branch}</p>
          </div>

          <p style="color: #555; line-height: 1.6;">We will confirm your booking shortly.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
            <p style="margin: 0;"><strong>Mahadev Inn Hotel Management</strong></p>
            <p style="margin: 5px 0 0;">© ${new Date().getFullYear()} All rights reserved</p>
          </div>
        </div>
      </div>
    `;

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM || 'Mahadev Inn <noreply@mahadevinn.com>',
      to: email,
      subject: subject,
      html: html,
    });

    console.log(`✅ Booking request email sent to ${email} for booking ${booking.bookingNo}`);
    return true;
  }

  // ✅ Send auto checkout email
  async sendAutoCheckoutEmail(
    email: string,
    guestName: string,
    bookingNo: string,
    branch: string,
    roomType: string,
  ) {
    const subject = `✅ Auto Checkout Completed - ${bookingNo}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa; border-radius: 10px;">
        <div style="text-align: center; padding: 20px; background: #4f46e5; border-radius: 10px 10px 0 0; color: white;">
          <h1 style="margin: 0;">🏨 MAHADEV INN</h1>
          <p style="margin: 5px 0 0; opacity: 0.8;">Auto Checkout Completed</p>
        </div>
        <div style="padding: 30px; background: white; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Dear ${guestName},</h2>
          <p style="color: #555; line-height: 1.6;">This is to confirm that you have been <strong style="color: #4f46e5;">automatically checked out</strong> from <strong>${branch}</strong>.</p>
          
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px; color: #4f46e5;">Booking Details</h3>
            <p style="margin: 5px 0;"><strong>Booking No:</strong> ${bookingNo}</p>
            <p style="margin: 5px 0;"><strong>Room Type:</strong> ${roomType}</p>
            <p style="margin: 5px 0;"><strong>Branch:</strong> ${branch}</p>
            <p style="margin: 5px 0;"><strong>Checkout Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>

          <p style="color: #555; line-height: 1.6;">Thank you for choosing Mahadev Inn! We hope you enjoyed your stay.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
            <p style="margin: 0;"><strong>Mahadev Inn Hotel Management</strong></p>
            <p style="margin: 5px 0 0;">© ${new Date().getFullYear()} All rights reserved</p>
          </div>
        </div>
      </div>
    `;

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM || 'Mahadev Inn <noreply@mahadevinn.com>',
      to: email,
      subject: subject,
      html: html,
    });

    console.log(`✅ Auto checkout email sent to ${email} for booking ${bookingNo}`);
    return true;
  }

  // ✅ Send checkout reminder email
  async sendCheckoutReminderEmail(
    email: string,
    guestName: string,
    bookingNo: string,
    checkOutDate: string,
    branch: string,
    roomType: string,
    daysUntil: number,
  ) {
    const subject = `⏰ Checkout Reminder - ${daysUntil} day${daysUntil > 1 ? 's' : ''} left - ${bookingNo}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa; border-radius: 10px;">
        <div style="text-align: center; padding: 20px; background: #f59e0b; border-radius: 10px 10px 0 0; color: white;">
          <h1 style="margin: 0;">🏨 MAHADEV INN</h1>
          <p style="margin: 5px 0 0; opacity: 0.8;">Checkout Reminder</p>
        </div>
        <div style="padding: 30px; background: white; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Dear ${guestName},</h2>
          <p style="color: #555; line-height: 1.6;">This is a reminder that you have <strong style="color: #f59e0b;">${daysUntil} day${daysUntil > 1 ? 's' : ''}</strong> left before checkout from <strong>${branch}</strong>.</p>
          
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="margin: 0 0 10px; color: #92400e;">Booking Details</h3>
            <p style="margin: 5px 0;"><strong>Booking No:</strong> ${bookingNo}</p>
            <p style="margin: 5px 0;"><strong>Room Type:</strong> ${roomType}</p>
            <p style="margin: 5px 0;"><strong>Branch:</strong> ${branch}</p>
            <p style="margin: 5px 0;"><strong>Checkout Date:</strong> ${checkOutDate}</p>
          </div>

          <p style="color: #555; line-height: 1.6;">Please prepare for your departure.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
            <p style="margin: 0;"><strong>Mahadev Inn Hotel Management</strong></p>
            <p style="margin: 5px 0 0;">© ${new Date().getFullYear()} All rights reserved</p>
          </div>
        </div>
      </div>
    `;

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM || 'Mahadev Inn <noreply@mahadevinn.com>',
      to: email,
      subject: subject,
      html: html,
    });

    console.log(`✅ Checkout reminder email sent to ${email} for booking ${bookingNo}`);
    return true;
  }
}