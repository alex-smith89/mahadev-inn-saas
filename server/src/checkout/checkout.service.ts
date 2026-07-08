// src/checkout/checkout.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationService } from '../notification/notification.service';
import { Branch } from '@prisma/client';

@Injectable()
export class CheckoutService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private notificationService: NotificationService,
  ) {}

  // ✅ Run auto checkout
  async runAutoCheckout() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const bookingsToCheckout = await this.prisma.booking.findMany({
      where: {
        bookingStatus: {
          in: ['Confirm', 'Confirmed', 'CheckedIn'],
        },
        checkOut: {
          lte: tomorrow,
        },
      },
    });

    const results = {
      processed: 0,
      notifications: 0,
      emails: 0,
      errors: 0,
    };

    for (const booking of bookingsToCheckout) {
      try {
        const checkOutDate = new Date(booking.checkOut);
        const daysUntilCheckout = Math.ceil((checkOutDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilCheckout <= 0) {
          await this.prisma.booking.update({
            where: { id: booking.id },
            data: {
              bookingStatus: 'CheckedOut',
            },
          });

          results.processed++;

          await this.notificationService.create({
            title: 'Automated Checkout Completed',
            message: `Guest ${booking.agentName} has been automatically checked out from ${booking.roomType} (${booking.branch}). Room is now vacant and requires cleaning.`,
            branch: booking.branch,
            bookingId: booking.id,
            type: 'auto_checkout',
          });

          results.notifications++;

          if (booking.email) {
            await this.emailService.sendAutoCheckoutEmail(
              booking.email,
              booking.agentName,
              booking.bookingNo,
              booking.branch,
              booking.roomType,
            );
            results.emails++;
          }
        } else if (daysUntilCheckout >= 1 && daysUntilCheckout <= 3) {
          const reminderTitles = {
            3: 'Checkout Reminder - 3 days left',
            2: 'Checkout Reminder - 2 days left',
            1: 'Checkout Reminder - 1 day left',
          };

          const reminderMessages = {
            3: `Guest ${booking.agentName} (Booking #${booking.bookingNo}) has checkout in 3 days from ${booking.roomType} (${booking.branch}).`,
            2: `Guest ${booking.agentName} (Booking #${booking.bookingNo}) has checkout in 2 days from ${booking.roomType} (${booking.branch}).`,
            1: `Guest ${booking.agentName} (Booking #${booking.bookingNo}) has checkout in 1 day from ${booking.roomType} (${booking.branch}).`,
          };

          await this.notificationService.create({
            title: reminderTitles[daysUntilCheckout as keyof typeof reminderTitles] || 'Checkout Reminder',
            message: reminderMessages[daysUntilCheckout as keyof typeof reminderMessages] || `Guest ${booking.agentName} has checkout in ${daysUntilCheckout} days.`,
            branch: booking.branch,
            bookingId: booking.id,
            type: 'checkout_reminder',
          });

          results.notifications++;

          if (booking.email) {
            await this.emailService.sendCheckoutReminderEmail(
              booking.email,
              booking.agentName,
              booking.bookingNo,
              booking.checkOut.toLocaleDateString(),
              booking.branch,
              booking.roomType,
              daysUntilCheckout,
            );
            results.emails++;
          }
        }
      } catch (error) {
        console.error(`Error processing booking ${booking.id}:`, error);
        results.errors++;
      }
    }

    return results;
  }

  async getTodayCheckouts() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.prisma.booking.findMany({
      where: {
        bookingStatus: {
          in: ['Confirm', 'Confirmed', 'CheckedIn'],
        },
        checkOut: {
          gte: today,
          lt: tomorrow,
        },
      },
      orderBy: { checkOut: 'asc' },
    });
  }

  async getUpcomingCheckouts(branch?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    const where: any = {
      bookingStatus: {
        in: ['Confirm', 'Confirmed', 'CheckedIn'],
      },
      checkOut: {
        gte: today,
        lte: dayAfterTomorrow,
      },
    };

    if (branch) {
      where.branch = branch;
    }

    return this.prisma.booking.findMany({
      where,
      orderBy: { checkOut: 'asc' },
    });
  }

  async getVacantRooms(branch?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where: any = {
      bookingStatus: {
        in: ['Confirm', 'Confirmed', 'CheckedIn'],
      },
      checkIn: {
        lte: today,
      },
      checkOut: {
        gt: today,
      },
    };

    if (branch) {
      where.branch = branch;
    }

    const occupiedBookings = await this.prisma.booking.findMany({
      where,
    });

    const roomCapacities: Record<string, number> = {
      'Pokhara': 65,
      'Kathmandu1': 50,
      'Kathmandu2': 45,
      'Bhairawaha': 40,
    };

    const totalRooms = branch ? (roomCapacities[branch] || 50) : 200;
    const occupiedRooms = occupiedBookings.reduce((sum: number, booking: any) => {
      return sum + (booking.roomsCount || 1);
    }, 0);

    const vacantRooms = Math.max(0, totalRooms - occupiedRooms);

    return {
      totalRooms,
      occupiedRooms,
      vacantRooms,
      occupancyRate: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0,
      branch: branch || 'all',
    };
  }

  async markRoomCleaned(bookingId: string, branch?: string) {
    console.log(`🧹 Room for booking ${bookingId} marked as cleaned`);
    return {
      success: true,
      bookingId,
      branch: branch || 'all',
      message: 'Room marked as cleaned successfully',
    };
  }
}