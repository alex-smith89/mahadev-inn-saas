// src/automation/automation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Branch } from '@prisma/client';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(private prisma: PrismaService) {}

  // ✅ RUN AUTO CHECK-IN - DIRECT AND SIMPLE
  async runAutoCheckin(user: any) {
    try {
      this.logger.log(`🔄 Auto check-in started by ${user.username || 'unknown'}`);

      // Get branch from user
      let branch = user.branch || user.selectedBranch || user.branchName || user.currentBranch;
      
      this.logger.log(`📍 Branch: ${branch || 'not specified'}`);

      // Determine target branches
      let targetBranches: string[] = [];
      
      if (branch && branch !== 'all' && branch !== 'undefined') {
        targetBranches = [branch];
      } else {
        // Get all distinct branches
        const allBranches = await this.prisma.booking.findMany({
          select: { branch: true },
          distinct: ['branch'],
        });
        targetBranches = allBranches.map(b => b.branch);
      }

      if (targetBranches.length === 0) {
        return {
          checkedIn: 0,
          bookings: [],
          message: 'No branches found',
        };
      }

      this.logger.log(`📋 Target branches: ${targetBranches.join(', ')}`);

      // ✅ Get today's date
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      this.logger.log(`📅 Today's date: ${today.toISOString()}`);

      // ✅ Find ALL bookings for target branches (not just Confirm)
      const allBookings = await this.prisma.booking.findMany({
        where: {
          branch: { in: targetBranches as Branch[] },
        },
      });

      this.logger.log(`📋 Found ${allBookings.length} total bookings`);

      // ✅ Filter for today's check-in (ANY status except CheckedIn and CheckedOut)
      const todayBookings = allBookings.filter(b => {
        const checkIn = new Date(b.checkIn);
        checkIn.setHours(0, 0, 0, 0);
        const isToday = checkIn.getTime() === today.getTime();
        const notCheckedIn = b.bookingStatus !== 'CheckedIn' && b.bookingStatus !== 'CheckedOut';
        
        if (isToday && notCheckedIn) {
          this.logger.log(`✅ Booking ${b.bookingNo} - ${b.agentName} check-in today, status: ${b.bookingStatus}`);
        }
        return isToday && notCheckedIn;
      });

      this.logger.log(`📋 Found ${todayBookings.length} bookings to check in today`);

      if (todayBookings.length === 0) {
        return {
          checkedIn: 0,
          bookings: [],
          message: `No bookings to check in today for branches: ${targetBranches.join(', ')}`,
        };
      }

      // ✅ Process check-ins
      let checkedIn = 0;
      const checkedInBookings = [];

      for (const booking of todayBookings) {
        try {
          this.logger.log(`🔄 Checking in: ${booking.bookingNo} - ${booking.agentName} (Status: ${booking.bookingStatus})`);

          // Update status to CheckedIn
          const updated = await this.prisma.booking.update({
            where: { id: booking.id },
            data: {
              bookingStatus: 'CheckedIn',
              updatedAt: new Date(),
            },
          });

          // Create notification
          await this.prisma.notification.create({
            data: {
              title: '✅ Auto Check-in',
              message: `${booking.agentName} (${booking.bookingNo}) checked in at ${booking.branch}`,
              branch: booking.branch,
              bookingId: booking.id,
              type: 'auto_checkin',
              createdAt: new Date(),
            },
          });

          checkedIn++;
          checkedInBookings.push(updated);
          this.logger.log(`✅ Checked in: ${booking.bookingNo} - ${booking.agentName}`);
        } catch (error) {
          this.logger.error(`❌ Error checking in ${booking.bookingNo}:`, error);
        }
      }

      return {
        checkedIn: checkedIn,
        bookings: checkedInBookings,
        message: `Successfully checked in ${checkedIn} guests`,
        branches: targetBranches,
      };
    } catch (error) {
      this.logger.error('❌ Error in auto check-in:', error);
      throw error;
    }
  }

  // ✅ DIRECT METHOD FOR BRANCH
  async runAutoCheckinForBranch(branch: string, user: any) {
    this.logger.log(`🔄 Auto check-in for branch: ${branch}`);
    user.branch = branch;
    user.selectedBranch = branch;
    return this.runAutoCheckin(user);
  }

  // ✅ RUN AUTO CHECK-OUT
  async runAutoCheckout(user: any) {
    try {
      this.logger.log(`🔄 Auto check-out started`);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const bookings = await this.prisma.booking.findMany({
        where: {
          bookingStatus: { in: ['CheckedIn', 'Confirm'] },
        },
      });

      const todayBookings = bookings.filter(b => {
        const checkOut = new Date(b.checkOut);
        checkOut.setHours(0, 0, 0, 0);
        return checkOut <= today;
      });

      let checkedOut = 0;
      const checkedOutBookings = [];

      for (const booking of todayBookings) {
        try {
          const updated = await this.prisma.booking.update({
            where: { id: booking.id },
            data: {
              bookingStatus: 'CheckedOut',
              updatedAt: new Date(),
            },
          });

          await this.prisma.notification.create({
            data: {
              title: '📤 Auto Check-out',
              message: `${booking.agentName} (${booking.bookingNo}) checked out from ${booking.branch}`,
              branch: booking.branch,
              bookingId: booking.id,
              type: 'auto_checkout',
              createdAt: new Date(),
            },
          });

          checkedOut++;
          checkedOutBookings.push(updated);
        } catch (error) {
          this.logger.error(`❌ Error checking out ${booking.bookingNo}:`, error);
        }
      }

      return {
        checkedOut: checkedOut,
        bookings: checkedOutBookings,
        message: `Successfully checked out ${checkedOut} guests`,
      };
    } catch (error) {
      this.logger.error('❌ Error in auto check-out:', error);
      throw error;
    }
  }

  // ✅ RUN FULL AUTOMATION
  async runFullAutomation(user: any) {
    try {
      const checkinResult = await this.runAutoCheckin(user);
      const checkoutResult = await this.runAutoCheckout(user);
      const reminderResult = await this.sendReminders(user);

      return {
        checkins: checkinResult,
        checkouts: checkoutResult,
        reminders: reminderResult,
        summary: {
          totalCheckedIn: checkinResult.checkedIn || 0,
          totalCheckedOut: checkoutResult.checkedOut || 0,
        },
      };
    } catch (error) {
      this.logger.error('❌ Error in full automation:', error);
      throw error;
    }
  }

  // ✅ SEND REMINDERS
  async sendReminders(user: any) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const bookings = await this.prisma.booking.findMany({
        where: {
          bookingStatus: { in: ['Confirm', 'Confirmed'] },
        },
      });

      let checkoutReminders = 0;
      let checkinReminders = 0;

      const checkoutBookings = bookings.filter(b => {
        const checkOut = new Date(b.checkOut);
        checkOut.setHours(0, 0, 0, 0);
        const diff = Math.ceil((checkOut.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diff > 0 && diff <= 3;
      });

      for (const booking of checkoutBookings) {
        const days = Math.ceil((new Date(booking.checkOut).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        await this.prisma.notification.create({
          data: {
            title: `📅 Checkout Reminder - ${days} day(s)`,
            message: `${booking.agentName} (${booking.bookingNo}) checkout in ${days} days`,
            branch: booking.branch,
            bookingId: booking.id,
            type: 'checkout_reminder',
            createdAt: new Date(),
          },
        });
        checkoutReminders++;
      }

      const checkinBookings = bookings.filter(b => {
        const checkIn = new Date(b.checkIn);
        checkIn.setHours(0, 0, 0, 0);
        return checkIn.getTime() === tomorrow.getTime();
      });

      for (const booking of checkinBookings) {
        await this.prisma.notification.create({
          data: {
            title: '📅 Check-in Tomorrow',
            message: `${booking.agentName} (${booking.bookingNo}) check-in tomorrow`,
            branch: booking.branch,
            bookingId: booking.id,
            type: 'checkin_reminder',
            createdAt: new Date(),
          },
        });
        checkinReminders++;
      }

      return {
        checkoutReminders,
        checkinReminders,
        message: `Sent ${checkoutReminders} checkout and ${checkinReminders} check-in reminders`,
      };
    } catch (error) {
      this.logger.error('❌ Error sending reminders:', error);
      throw error;
    }
  }

  // ✅ GET TODAY'S SUMMARY
  async getTodaySummary(user: any) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const bookings = await this.prisma.booking.findMany();

      const todayCheckins = bookings.filter(b => {
        const checkIn = new Date(b.checkIn);
        checkIn.setHours(0, 0, 0, 0);
        return checkIn.getTime() === today.getTime() && 
               ['Confirm', 'Confirmed'].includes(b.bookingStatus);
      });

      const todayCheckouts = bookings.filter(b => {
        const checkOut = new Date(b.checkOut);
        checkOut.setHours(0, 0, 0, 0);
        return checkOut.getTime() === today.getTime() && 
               ['CheckedIn', 'Confirm'].includes(b.bookingStatus);
      });

      return {
        date: today.toISOString(),
        checkins: {
          count: todayCheckins.length,
          bookings: todayCheckins,
        },
        checkouts: {
          count: todayCheckouts.length,
          bookings: todayCheckouts,
        },
      };
    } catch (error) {
      this.logger.error('❌ Error getting today summary:', error);
      throw error;
    }
  }

  // ✅ GET AUTOMATION STATUS
  async getAutomationStatus(user: any) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const bookings = await this.prisma.booking.findMany();

      const checkinToday = bookings.filter(b => {
        const checkIn = new Date(b.checkIn);
        checkIn.setHours(0, 0, 0, 0);
        return checkIn.getTime() === today.getTime() && 
               ['Confirm', 'Confirmed'].includes(b.bookingStatus);
      }).length;

      const checkinTomorrow = bookings.filter(b => {
        const checkIn = new Date(b.checkIn);
        checkIn.setHours(0, 0, 0, 0);
        return checkIn.getTime() === tomorrow.getTime() && 
               ['Confirm', 'Confirmed'].includes(b.bookingStatus);
      }).length;

      const checkoutToday = bookings.filter(b => {
        const checkOut = new Date(b.checkOut);
        checkOut.setHours(0, 0, 0, 0);
        return checkOut.getTime() === today.getTime() && 
               ['CheckedIn', 'Confirm'].includes(b.bookingStatus);
      }).length;

      return {
        checkinToday,
        checkinTomorrow,
        checkoutToday,
        summary: `Today: ${checkinToday} check-ins, ${checkoutToday} check-outs`,
      };
    } catch (error) {
      this.logger.error('❌ Error getting automation status:', error);
      throw error;
    }
  }
}