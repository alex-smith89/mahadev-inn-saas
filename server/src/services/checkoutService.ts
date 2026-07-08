import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

// Email configuration
const getTransporter = () => {
  const smtpHost = process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587');
  const smtpUser = process.env.EMAIL_USER || process.env.SMTP_USER;
  const smtpPass = process.env.EMAIL_PASSWORD || process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    console.warn('⚠️ Email credentials not configured. Email notifications will be disabled.');
    return null;
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass.replace(/\s/g, ''),
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

export class CheckoutService {
  
  // Check for upcoming checkouts (within 24-48 hours)
  async checkUpcomingCheckouts() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    dayAfterTomorrow.setHours(0, 0, 0, 0);

    try {
      const upcomingCheckouts = await prisma.booking.findMany({
        where: {
          checkOut: {
            gte: tomorrow,
            lt: dayAfterTomorrow,
          },
          bookingStatus: {
            in: ['Confirm', 'Confirmed', 'CheckedIn'],
          },
        },
      });

      return upcomingCheckouts;
    } catch (error) {
      console.error('Error checking upcoming checkouts:', error);
      return [];
    }
  }

  // Check for today's checkouts (for automated checkout)
  async checkTodayCheckouts() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    try {
      const todayCheckouts = await prisma.booking.findMany({
        where: {
          checkOut: {
            gte: today,
            lt: tomorrow,
          },
          bookingStatus: {
            in: ['Confirm', 'Confirmed', 'CheckedIn'],
          },
        },
      });

      return todayCheckouts;
    } catch (error) {
      console.error('Error checking today\'s checkouts:', error);
      return [];
    }
  }

  // Send checkout reminder email
  async sendCheckoutReminder(booking: any, daysUntil: number) {
    try {
      const transporter = getTransporter();
      if (!transporter) {
        console.log('📧 Email service not configured. Skipping email notification.');
        await this.createSystemNotification(booking, daysUntil);
        return false;
      }

      const guestEmail = booking.email || booking.agentContact;
      const guestName = booking.agentName || 'Guest';

      if (!guestEmail || !guestEmail.includes('@')) {
        console.log(`No valid email found for guest: ${guestName}`);
        await this.createSystemNotification(booking, daysUntil);
        return false;
      }

      const dayText = daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;
      const subject = daysUntil === 1 
        ? '🛎️ Checkout Reminder - Tomorrow is your checkout day!' 
        : `🛎️ Checkout Reminder - Your checkout is ${dayText}`;

      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.SMTP_FROM || 'noreply@mahadevinn.com',
        to: guestEmail,
        subject: subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa; border-radius: 10px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h1 style="color: #4f46e5; margin-top: 10px;">Mahadev Inn</h1>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h2 style="color: #333;">${daysUntil === 1 ? '⚠️ Checkout Tomorrow' : '📅 Checkout Reminder'}</h2>
              <p style="color: #555; font-size: 16px;">Dear <strong>${guestName}</strong>,</p>
              
              <p style="color: #555; font-size: 16px;">
                This is a reminder that your checkout is scheduled for <strong>${new Date(booking.checkOut).toLocaleDateString()}</strong>.
                ${daysUntil === 1 ? ' Please prepare for your departure.' : ''}
              </p>
              
              <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin: 15px 0; border-radius: 4px;">
                <p style="margin: 5px 0;"><strong>📋 Booking Details:</strong></p>
                <p style="margin: 5px 0;">Booking #: <strong>${booking.bookingNo}</strong></p>
                <p style="margin: 5px 0;">Room: <strong>${booking.roomType}</strong></p>
                <p style="margin: 5px 0;">Checkout Date: <strong>${new Date(booking.checkOut).toLocaleDateString()}</strong></p>
                <p style="margin: 5px 0;">Checkout Time: <strong>12:00 PM (Noon)</strong></p>
                <p style="margin: 5px 0;">Branch: <strong>${booking.branch}</strong></p>
              </div>
              
              <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0; border-radius: 4px;">
                <p style="margin: 5px 0; color: #dc2626;"><strong>⚠️ Important:</strong></p>
                <p style="margin: 5px 0; font-size: 14px; color: #666;">
                  ${daysUntil === 1 
                    ? 'Please ensure you check out by 12:00 PM (Noon) tomorrow. Late checkout may incur additional charges.'
                    : 'Please ensure you check out by 12:00 PM (Noon) on your checkout day.'
                  }
                </p>
              </div>
              
              <div style="margin: 20px 0; padding: 15px; background: #f8fafc; border-radius: 4px;">
                <p style="margin: 5px 0; font-size: 14px; color: #666;">
                  <strong>📍 Branch Address:</strong><br/>
                  Mahadev Inn, ${booking.branch}<br/>
                  Phone: +977-1-4444444
                </p>
              </div>
              
              <p style="color: #555; font-size: 14px; margin-top: 15px;">
                Thank you for choosing Mahadev Inn. We hope you enjoyed your stay!
              </p>
              
              <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="color: #999; font-size: 12px;">
                  © ${new Date().getFullYear()} Mahadev Inn. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`✅ Checkout reminder sent to ${guestEmail} (${daysUntil} days until checkout)`);
      
      await this.createSystemNotification(booking, daysUntil);
      
      return true;
    } catch (error) {
      console.error('Error sending checkout reminder:', error);
      await this.createSystemNotification(booking, daysUntil);
      return false;
    }
  }

  // Create system notification for checkout reminder
  async createSystemNotification(booking: any, daysUntil: number) {
    try {
      const guestName = booking.agentName || 'Guest';
      
      await prisma.notification.create({
        data: {
          type: 'CHECKOUT_REMINDER',
          title: `Checkout Reminder - ${daysUntil} day${daysUntil > 1 ? 's' : ''} left`,
          message: `Guest ${guestName} (Booking #${booking.bookingNo}) has checkout in ${daysUntil} day${daysUntil > 1 ? 's' : ''}.`,
          branch: booking.branch,
          bookingId: booking.id,
          isRead: false,
        },
      });
    } catch (error) {
      console.error('Error creating system notification:', error);
    }
  }

  // Process automated checkout at 12 PM
  async processAutomatedCheckout(bookingId: string) {
    try {
      const booking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          bookingStatus: 'CheckedOut',
        },
      });

      // Create notification for housekeeping
      await prisma.notification.create({
        data: {
          type: 'ROOM_VACANT',
          title: '🛏️ Room Vacant - Ready for Cleaning',
          message: `Room ${booking.roomType} (${booking.branch}) - Booking #${booking.bookingNo} is now vacant. Guest: ${booking.agentName}. Please clean and prepare for next guest.`,
          branch: booking.branch,
          roomId: booking.roomType,
          bookingId: booking.id,
          isRead: false,
        },
      });

      // Create notification for report page
      await prisma.notification.create({
        data: {
          type: 'CHECKOUT_COMPLETED',
          title: '✅ Automated Checkout Completed',
          message: `Guest ${booking.agentName} has been automatically checked out from ${booking.roomType} (${booking.branch}). Room is now vacant and requires cleaning.`,
          branch: booking.branch,
          bookingId: booking.id,
          isRead: false,
        },
      });

      console.log(`✅ Automated checkout processed for booking: ${booking.bookingNo}`);
      return booking;
    } catch (error) {
      console.error('Error processing automated checkout:', error);
      throw error;
    }
  }

  // Run full automated checkout process
  async runAutoCheckout() {
    console.log('🔄 Running automated checkout checks...');
    console.log(`⏰ Current time: ${new Date().toLocaleString()}`);
    
    try {
      const now = new Date();
      const currentHour = now.getHours();
      
      // 1. Check for upcoming checkouts (24-48 hours)
      const upcomingCheckouts = await this.checkUpcomingCheckouts();
      
      if (upcomingCheckouts.length > 0) {
        console.log(`📋 Found ${upcomingCheckouts.length} upcoming checkouts.`);
        
        for (const booking of upcomingCheckouts) {
          const daysUntil = Math.ceil(
            (new Date(booking.checkOut).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          
          if (daysUntil <= 2 && daysUntil > 0) {
            await this.sendCheckoutReminder(booking, daysUntil);
          }
        }
      }

      // 2. Check for today's checkouts
      const todayCheckouts = await this.checkTodayCheckouts();
      
      if (todayCheckouts.length === 0) {
        console.log('No checkouts scheduled for today.');
        return { reminders: upcomingCheckouts.length, processed: 0, notifications: 0 };
      }

      console.log(`📋 Found ${todayCheckouts.length} checkouts for today.`);

      let processed = 0;
      let notifications = 0;

      for (const booking of todayCheckouts) {
        await this.sendCheckoutReminder(booking, 1);
        
        if (currentHour >= 12) {
          await this.processAutomatedCheckout(booking.id);
          processed++;
          notifications += 2;
        } else {
          console.log(`⏳ Waiting for 12 PM to process checkout for booking: ${booking.bookingNo}`);
        }
      }

      console.log(`✅ Processed ${processed} checkouts, sent ${upcomingCheckouts.length} reminders, created ${notifications} notifications`);
      return { 
        reminders: upcomingCheckouts.length, 
        processed, 
        notifications 
      };
    } catch (error) {
      console.error('Error in runAutoCheckout:', error);
      return { reminders: 0, processed: 0, notifications: 0 };
    }
  }

  // Get vacant rooms for cleanup
  async getVacantRooms(branch?: string) {
    try {
      const where: any = {
        bookingStatus: 'CheckedOut',
      };
      
      if (branch) {
        where.branch = branch;
      }

      const vacantBookings = await prisma.booking.findMany({
        where,
        select: {
          id: true,
          bookingNo: true,
          roomType: true,
          branch: true,
          agentName: true,
          checkOut: true,
          createdAt: true,
        },
        orderBy: {
          checkOut: 'desc',
        },
      });

      return vacantBookings.map(b => ({
        id: b.id,
        bookingNo: b.bookingNo,
        type: b.roomType,
        branch: b.branch,
        guestName: b.agentName,
        checkoutDate: b.checkOut,
        status: 'Vacant',
      }));
    } catch (error) {
      console.error('Error getting vacant rooms:', error);
      return [];
    }
  }
}