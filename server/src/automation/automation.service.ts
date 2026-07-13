// src/automation/automation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Branch, BookingStatus } from '@prisma/client';
import { EmailService } from '../email/email.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private notificationService: NotificationService,
  ) {}

  // ✅ RUN AUTO CHECK-IN WITH NOTIFICATIONS
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
        const allBranches = await this.prisma.booking.findMany({
          select: { branch: true },
          distinct: ['branch'],
        });
        targetBranches = allBranches.map(b => b.branch);
      }

      if (targetBranches.length === 0) {
        return {
          checkedIn: 0,
          checkoutReminders: 0,
          checkinReminders: 0,
          bookings: [],
          message: 'No branches found',
        };
      }

      this.logger.log(`📋 Target branches: ${targetBranches.join(', ')}`);

      // ✅ Get today's date
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const dayAfterTomorrow = new Date(today);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

      // ✅ Find ALL bookings for target branches
      const allBookings = await this.prisma.booking.findMany({
        where: {
          branch: { in: targetBranches as Branch[] },
        },
      });

      this.logger.log(`📋 Found ${allBookings.length} total bookings`);

      // ✅ 1. PROCESS CHECK-INS (Today's bookings)
      const todayBookings = allBookings.filter(b => {
        const checkIn = new Date(b.checkIn);
        checkIn.setHours(0, 0, 0, 0);
        const isToday = checkIn.getTime() === today.getTime();
        const notCheckedIn = b.bookingStatus !== 'CheckedIn' && b.bookingStatus !== 'CheckedOut';
        return isToday && notCheckedIn;
      });

      this.logger.log(`📋 Found ${todayBookings.length} bookings to check in today`);

      let checkedIn = 0;
      const checkedInBookings = [];

      for (const booking of todayBookings) {
        try {
          this.logger.log(`🔄 Checking in: ${booking.bookingNo} - ${booking.agentName}`);

          // Update status to CheckedIn
          const updated = await this.prisma.booking.update({
            where: { id: booking.id },
            data: {
              bookingStatus: 'CheckedIn',
              actualCheckIn: new Date(),
              updatedAt: new Date(),
            },
          });

          // ✅ Create system notification for check-in
          await this.notificationService.createCheckinNotification(updated);

          // ✅ Send email notification for check-in
          if (booking.email) {
            await this.emailService.sendEmail({
              to: booking.email,
              subject: `Check-in Confirmation - ${booking.bookingNo}`,
              template: 'checkin_confirmation',
              data: {
                guestName: booking.agentName,
                bookingNo: booking.bookingNo,
                checkInDate: booking.checkIn,
                checkOutDate: booking.checkOut,
                branch: booking.branch,
              },
            });
          }

          checkedIn++;
          checkedInBookings.push(updated);
          this.logger.log(`✅ Checked in: ${booking.bookingNo} - ${booking.agentName}`);
        } catch (error) {
          this.logger.error(`❌ Error checking in ${booking.bookingNo}:`, error);
        }
      }

      // ✅ 2. PROCESS CHECKOUT REMINDERS (Tomorrow and Day After Tomorrow)
      const checkoutReminderBookings = allBookings.filter(b => {
        const checkOut = new Date(b.checkOut);
        checkOut.setHours(0, 0, 0, 0);
        const isTomorrow = checkOut.getTime() === tomorrow.getTime();
        const isDayAfter = checkOut.getTime() === dayAfterTomorrow.getTime();
        const isCheckedIn = b.bookingStatus === 'CheckedIn' || b.bookingStatus === 'Confirm';
        return (isTomorrow || isDayAfter) && isCheckedIn;
      });

      this.logger.log(`📋 Found ${checkoutReminderBookings.length} checkout reminders to send`);

      let checkoutReminderCount = 0;

      for (const booking of checkoutReminderBookings) {
        try {
          const checkOutDate = new Date(booking.checkOut);
          const daysUntilCheckout = Math.ceil((checkOutDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          // ✅ Create system notification for checkout reminder
          await this.notificationService.createCheckoutReminder(booking, daysUntilCheckout);

          // ✅ Send email notification to guest for checkout reminder
          if (booking.email) {
            await this.emailService.sendEmail({
              to: booking.email,
              subject: `Checkout Reminder - ${booking.bookingNo}`,
              template: 'checkout_reminder',
              data: {
                guestName: booking.agentName,
                bookingNo: booking.bookingNo,
                checkOutDate: booking.checkOut,
                daysUntilCheckout: daysUntilCheckout,
                branch: booking.branch,
              },
            });
          }

          // ✅ Send email to manager/admin about room vacating
          if (user.email) {
            await this.emailService.sendEmail({
              to: user.email,
              subject: `📋 Room Vacating Alert - ${booking.bookingNo}`,
              template: 'manager_checkout_alert',
              data: {
                guestName: booking.agentName,
                bookingNo: booking.bookingNo,
                checkOutDate: booking.checkOut,
                daysUntilCheckout: daysUntilCheckout,
                branch: booking.branch,
              },
            });
          }

          checkoutReminderCount++;
          this.logger.log(`📤 Checkout reminder sent for: ${booking.bookingNo} - ${booking.agentName} (${daysUntilCheckout} days)`);
        } catch (error) {
          this.logger.error(`❌ Error sending checkout reminder for ${booking.bookingNo}:`, error);
        }
      }

      // ✅ 3. PROCESS CHECK-IN REMINDERS (Tomorrow's check-ins)
      const tomorrowCheckins = allBookings.filter(b => {
        const checkIn = new Date(b.checkIn);
        checkIn.setHours(0, 0, 0, 0);
        const isTomorrow = checkIn.getTime() === tomorrow.getTime();
        return isTomorrow && b.bookingStatus === 'Confirm';
      });

      this.logger.log(`📋 Found ${tomorrowCheckins.length} check-in reminders to send`);

      let checkinReminderCount = 0;

      for (const booking of tomorrowCheckins) {
        try {
          // ✅ Create system notification for check-in reminder
          await this.notificationService.createCheckinReminder(booking);

          // ✅ Send email notification for check-in reminder
          if (booking.email) {
            await this.emailService.sendEmail({
              to: booking.email,
              subject: `Check-in Reminder - ${booking.bookingNo}`,
              template: 'checkin_reminder',
              data: {
                guestName: booking.agentName,
                bookingNo: booking.bookingNo,
                checkInDate: booking.checkIn,
                branch: booking.branch,
              },
            });
          }

          checkinReminderCount++;
          this.logger.log(`📅 Check-in reminder sent for: ${booking.bookingNo} - ${booking.agentName}`);
        } catch (error) {
          this.logger.error(`❌ Error sending check-in reminder for ${booking.bookingNo}:`, error);
        }
      }

      return {
        checkedIn: checkedIn,
        checkedInBookings: checkedInBookings,
        checkoutReminders: checkoutReminderCount,
        checkoutReminderBookings: checkoutReminderBookings,
        checkinReminders: checkinReminderCount,
        branches: targetBranches,
        message: `Checked in ${checkedIn} guests. Sent ${checkoutReminderCount} checkout reminders and ${checkinReminderCount} check-in reminders.`,
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
      this.logger.log(`🔄 Auto check-out started by ${user.username || 'unknown'}`);

      // Get branch from user
      let branch = user.branch || user.selectedBranch || user.branchName || user.currentBranch;
      
      // Determine target branches
      let targetBranches: string[] = [];
      
      if (branch && branch !== 'all' && branch !== 'undefined') {
        targetBranches = [branch];
      } else {
        const allBranches = await this.prisma.booking.findMany({
          select: { branch: true },
          distinct: ['branch'],
        });
        targetBranches = allBranches.map(b => b.branch);
      }

      if (targetBranches.length === 0) {
        return {
          checkedOut: 0,
          bookings: [],
          message: 'No branches found',
        };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const bookings = await this.prisma.booking.findMany({
        where: {
          branch: { in: targetBranches as Branch[] },
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
              actualCheckOut: new Date(),
              updatedAt: new Date(),
            },
          });

          // ✅ Create system notification for check-out
          await this.notificationService.createCheckoutNotification(updated);
          
          // ✅ Create room vacant notification
          await this.notificationService.createRoomVacantNotification(updated);

          // ✅ Send email notification for check-out
          if (booking.email) {
            await this.emailService.sendEmail({
              to: booking.email,
              subject: `Check-out Confirmation - ${booking.bookingNo}`,
              template: 'checkout_confirmation',
              data: {
                guestName: booking.agentName,
                bookingNo: booking.bookingNo,
                checkOutDate: booking.checkOut,
                branch: booking.branch,
              },
            });
          }

          checkedOut++;
          checkedOutBookings.push(updated);
          this.logger.log(`✅ Checked out: ${booking.bookingNo} - ${booking.agentName}`);
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
      this.logger.log(`🚀 Running full automation by ${user.username || 'unknown'}`);

      const checkinResult = await this.runAutoCheckin(user);
      const checkoutResult = await this.runAutoCheckout(user);

      return {
        checkins: checkinResult,
        checkouts: checkoutResult,
        summary: {
          totalCheckedIn: checkinResult.checkedIn || 0,
          totalCheckedOut: checkoutResult.checkedOut || 0,
          totalCheckoutReminders: checkinResult.checkoutReminders || 0,
          totalCheckinReminders: checkinResult.checkinReminders || 0,
        },
      };
    } catch (error) {
      this.logger.error('❌ Error in full automation:', error);
      throw error;
    }
  }

  // ✅ GET TODAY'S SUMMARY
  async getTodaySummary(user: any) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get branch from user
      let branch = user.branch || user.selectedBranch || user.branchName || user.currentBranch;
      
      let targetBranches: string[] = [];
      
      if (branch && branch !== 'all' && branch !== 'undefined') {
        targetBranches = [branch];
      } else {
        const allBranches = await this.prisma.booking.findMany({
          select: { branch: true },
          distinct: ['branch'],
        });
        targetBranches = allBranches.map(b => b.branch);
      }

      const bookings = await this.prisma.booking.findMany({
        where: {
          branch: { in: targetBranches as Branch[] },
        },
      });

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

      const tomorrowCheckouts = bookings.filter(b => {
        const checkOut = new Date(b.checkOut);
        checkOut.setHours(0, 0, 0, 0);
        return checkOut.getTime() === tomorrow.getTime() && 
               ['CheckedIn', 'Confirm'].includes(b.bookingStatus);
      });

      return {
        date: today.toISOString(),
        branches: targetBranches,
        checkins: {
          count: todayCheckins.length,
          bookings: todayCheckins,
        },
        checkouts: {
          today: {
            count: todayCheckouts.length,
            bookings: todayCheckouts,
          },
          tomorrow: {
            count: tomorrowCheckouts.length,
            bookings: tomorrowCheckouts,
          },
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
      const dayAfterTomorrow = new Date(today);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

      // Get branch from user
      let branch = user.branch || user.selectedBranch || user.branchName || user.currentBranch;
      
      let targetBranches: string[] = [];
      
      if (branch && branch !== 'all' && branch !== 'undefined') {
        targetBranches = [branch];
      } else {
        const allBranches = await this.prisma.booking.findMany({
          select: { branch: true },
          distinct: ['branch'],
        });
        targetBranches = allBranches.map(b => b.branch);
      }

      const bookings = await this.prisma.booking.findMany({
        where: {
          branch: { in: targetBranches as Branch[] },
        },
      });

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

      const checkoutTomorrow = bookings.filter(b => {
        const checkOut = new Date(b.checkOut);
        checkOut.setHours(0, 0, 0, 0);
        return checkOut.getTime() === tomorrow.getTime() && 
               ['CheckedIn', 'Confirm'].includes(b.bookingStatus);
      }).length;

      const checkoutDayAfter = bookings.filter(b => {
        const checkOut = new Date(b.checkOut);
        checkOut.setHours(0, 0, 0, 0);
        return checkOut.getTime() === dayAfterTomorrow.getTime() && 
               ['CheckedIn', 'Confirm'].includes(b.bookingStatus);
      }).length;

      return {
        branches: targetBranches,
        checkinToday,
        checkinTomorrow,
        checkoutToday,
        checkoutTomorrow,
        checkoutDayAfter,
        summary: {
          today: `Today: ${checkinToday} check-ins, ${checkoutToday} check-outs`,
          tomorrow: `Tomorrow: ${checkinTomorrow} check-ins, ${checkoutTomorrow} check-outs`,
          dayAfter: `Day After: ${checkoutDayAfter} check-outs`,
        },
      };
    } catch (error) {
      this.logger.error('❌ Error getting automation status:', error);
      throw error;
    }
  }

  // ✅ GET NOTIFICATIONS
  async getNotifications(user: any) {
    try {
      const branch = user.branch || user.selectedBranch;
      
      const notifications = await this.prisma.notification.findMany({
        where: {
          branch: branch as Branch || undefined,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50,
        include: {
          booking: {
            select: {
              bookingNo: true,
              agentName: true,
            },
          },
        },
      });

      return notifications;
    } catch (error) {
      this.logger.error('❌ Error getting notifications:', error);
      throw error;
    }
  }

  // ✅ MARK NOTIFICATION AS READ
  async markNotificationRead(id: string) {
    try {
      return await this.prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });
    } catch (error) {
      this.logger.error('❌ Error marking notification as read:', error);
      throw error;
    }
  }

  // ✅ MARK ALL NOTIFICATIONS AS READ
  async markAllNotificationsRead(user: any) {
    try {
      const branch = user.branch || user.selectedBranch;
      
      return await this.prisma.notification.updateMany({
        where: {
          branch: branch as Branch || undefined,
          isRead: false,
        },
        data: { isRead: true },
      });
    } catch (error) {
      this.logger.error('❌ Error marking all notifications as read:', error);
      throw error;
    }
  }

  // ✅ GET UNREAD NOTIFICATION COUNT
  async getUnreadNotificationCount(user: any) {
    try {
      const branch = user.branch || user.selectedBranch;
      
      return await this.prisma.notification.count({
        where: {
          branch: branch as Branch || undefined,
          isRead: false,
        },
      });
    } catch (error) {
      this.logger.error('❌ Error getting unread notification count:', error);
      throw error;
    }
  }
}