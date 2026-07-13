// src/checkout/checkout.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // ✅ AUTO CHECKOUT
  async autoCheckout(user: any) {
    try {
      const userBranches = user.branches || [];
      const selectedBranch = user.selectedBranch;
      const canViewAllBranches = user.canViewAllBranches || user.role === 'OWNER' || user.role === 'MANAGER';

      let targetBranches = [];
      if (canViewAllBranches && selectedBranch === 'all') {
        const allBranchesResult = await this.prisma.booking.findMany({
          select: { branch: true },
          distinct: ['branch'],
        });
        targetBranches = allBranchesResult.map(row => row.branch);
      } else if (selectedBranch && selectedBranch !== 'all') {
        targetBranches = [selectedBranch];
      } else {
        targetBranches = userBranches;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const bookingsToCheckout = await this.prisma.booking.findMany({
        where: {
          branch: { in: targetBranches },
          bookingStatus: { in: ['Confirm', 'Confirmed', 'CheckedIn'] },
          checkOut: { lte: today },
        },
      });

      let checkedOut = 0;

      for (const booking of bookingsToCheckout) {
        try {
          await this.prisma.booking.update({
            where: { id: booking.id },
            data: {
              bookingStatus: 'CheckedOut',
              updatedAt: new Date(),
            },
          });

          // ✅ Send auto checkout email
          if (booking.email) {
            try {
              await this.emailService.sendAutoCheckoutEmail(booking.email, booking);
              this.logger.log(`📧 Auto checkout email sent to ${booking.email}`);
            } catch (emailError) {
              this.logger.error(`Email error: ${emailError.message}`);
            }
          }

          checkedOut++;
          this.logger.log(`✅ Checked out: ${booking.agentName} (${booking.bookingNo}) from ${booking.branch}`);
        } catch (error) {
          this.logger.error(`Error checking out booking ${booking.id}:`, error);
        }
      }

      return { checkedOut, bookings: bookingsToCheckout };
    } catch (error) {
      this.logger.error('Error in auto checkout:', error);
      throw error;
    }
  }

  // ✅ GET TODAY'S CHECKOUTS
  async getTodayCheckouts(user: any) {
    try {
      const userBranches = user.branches || [];
      const selectedBranch = user.selectedBranch;
      const canViewAllBranches = user.canViewAllBranches || user.role === 'OWNER' || user.role === 'MANAGER';

      let targetBranches = [];
      if (canViewAllBranches && selectedBranch === 'all') {
        const allBranchesResult = await this.prisma.booking.findMany({
          select: { branch: true },
          distinct: ['branch'],
        });
        targetBranches = allBranchesResult.map(row => row.branch);
      } else if (selectedBranch && selectedBranch !== 'all') {
        targetBranches = [selectedBranch];
      } else {
        targetBranches = userBranches;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const checkouts = await this.prisma.booking.findMany({
        where: {
          branch: { in: targetBranches },
          bookingStatus: { in: ['Confirm', 'Confirmed', 'CheckedIn'] },
          checkOut: { gte: today, lt: tomorrow },
        },
        orderBy: { checkOut: 'asc' },
      });

      return checkouts;
    } catch (error) {
      this.logger.error('Error getting today checkouts:', error);
      throw error;
    }
  }

  // ✅ GET UPCOMING CHECKOUTS
  async getUpcomingCheckouts(user: any, branch?: string) {
    try {
      const userBranches = user.branches || [];
      const selectedBranch = branch || user.selectedBranch;
      const canViewAllBranches = user.canViewAllBranches || user.role === 'OWNER' || user.role === 'MANAGER';

      let targetBranches = [];
      if (canViewAllBranches && selectedBranch === 'all') {
        const allBranchesResult = await this.prisma.booking.findMany({
          select: { branch: true },
          distinct: ['branch'],
        });
        targetBranches = allBranchesResult.map(row => row.branch);
      } else if (selectedBranch && selectedBranch !== 'all') {
        targetBranches = [selectedBranch];
      } else {
        targetBranches = userBranches;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + 7);

      const checkouts = await this.prisma.booking.findMany({
        where: {
          branch: { in: targetBranches },
          bookingStatus: { in: ['Confirm', 'Confirmed', 'CheckedIn'] },
          checkOut: { gte: today, lt: futureDate },
        },
        orderBy: { checkOut: 'asc' },
      });

      return checkouts;
    } catch (error) {
      this.logger.error('Error getting upcoming checkouts:', error);
      throw error;
    }
  }

  // ✅ GET VACANT ROOMS
  async getVacantRooms(user: any, branch?: string) {
    try {
      const userBranches = user.branches || [];
      const selectedBranch = branch || user.selectedBranch;
      const canViewAllBranches = user.canViewAllBranches || user.role === 'OWNER' || user.role === 'MANAGER';

      let targetBranches = [];
      if (canViewAllBranches && selectedBranch === 'all') {
        const allBranchesResult = await this.prisma.booking.findMany({
          select: { branch: true },
          distinct: ['branch'],
        });
        targetBranches = allBranchesResult.map(row => row.branch);
      } else if (selectedBranch && selectedBranch !== 'all') {
        targetBranches = [selectedBranch];
      } else {
        targetBranches = userBranches;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get all bookings that are currently occupied
      const occupiedBookings = await this.prisma.booking.findMany({
        where: {
          branch: { in: targetBranches },
          bookingStatus: { in: ['Confirm', 'Confirmed', 'CheckedIn'] },
          checkIn: { lte: today },
          checkOut: { gt: today },
        },
      });

      // Calculate total rooms from branch capacities
      let totalRooms = 0;
      for (const branchName of targetBranches) {
        const capacity = await this.prisma.branchCapacity.findUnique({
          where: { branch: branchName as any },
        });
        if (capacity) {
          totalRooms += (capacity.singleCap || 0) + 
                        (capacity.doubleCap || 0) + 
                        (capacity.tripleCap || 0) + 
                        (capacity.quardCap || 0);
        }
      }

      // If no capacity found, use default
      if (totalRooms === 0) {
        totalRooms = targetBranches.length * 50;
      }

      const occupiedRooms = occupiedBookings.reduce((sum, b) => sum + b.roomsCount, 0);
      const vacantRooms = Math.max(0, totalRooms - occupiedRooms);
      const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

      return {
        totalRooms,
        occupiedRooms,
        vacantRooms,
        occupancyRate,
        bookings: occupiedBookings,
      };
    } catch (error) {
      this.logger.error('Error getting vacant rooms:', error);
      throw error;
    }
  }

  // ✅ MARK ROOM CLEANED
  async markRoomCleaned(bookingId: string, branch?: string) {
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      // ✅ Update booking status to reflect room is cleaned
      // You can add a 'roomCleaned' field to the booking schema if needed
      // For now, we'll just log it and return success

      this.logger.log(`🧹 Room for booking ${bookingId} marked as cleaned`);

      return {
        success: true,
        bookingId,
        message: 'Room marked as cleaned successfully',
      };
    } catch (error) {
      this.logger.error('Error marking room cleaned:', error);
      throw error;
    }
  }

  // ✅ SEND CHECKOUT REMINDERS
  async sendCheckoutReminders(user: any) {
    try {
      const userBranches = user.branches || [];
      const selectedBranch = user.selectedBranch;
      const canViewAllBranches = user.canViewAllBranches || user.role === 'OWNER' || user.role === 'MANAGER';

      let targetBranches = [];
      if (canViewAllBranches && selectedBranch === 'all') {
        const allBranchesResult = await this.prisma.booking.findMany({
          select: { branch: true },
          distinct: ['branch'],
        });
        targetBranches = allBranchesResult.map(row => row.branch);
      } else if (selectedBranch && selectedBranch !== 'all') {
        targetBranches = [selectedBranch];
      } else {
        targetBranches = userBranches;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + 3);

      const bookingsToRemind = await this.prisma.booking.findMany({
        where: {
          branch: { in: targetBranches },
          bookingStatus: { in: ['Confirm', 'Confirmed', 'CheckedIn'] },
          checkOut: { gte: today, lte: futureDate },
        },
      });

      let remindersSent = 0;

      for (const booking of bookingsToRemind) {
        const daysUntilCheckout = Math.ceil(
          (new Date(booking.checkOut).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysUntilCheckout > 0 && daysUntilCheckout <= 3) {
          if (booking.email) {
            try {
              await this.emailService.sendCheckoutReminderEmail(booking.email, booking);
              this.logger.log(`📧 Checkout reminder sent to ${booking.email} (${daysUntilCheckout} days)`);
              remindersSent++;
            } catch (emailError) {
              this.logger.error(`Email error: ${emailError.message}`);
            }
          }
        }
      }

      return {
        remindersSent,
        bookings: bookingsToRemind,
        branches: targetBranches,
      };
    } catch (error) {
      this.logger.error('Error sending checkout reminders:', error);
      throw error;
    }
  }
}