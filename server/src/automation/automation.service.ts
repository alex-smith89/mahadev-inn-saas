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
        orderBy: {
          checkIn: 'desc',
        },
      });

      this.logger.log(`📋 Found ${allBookings.length} total bookings`);

      // ✅ 1. PROCESS CHECK-INS (Today's bookings that are not checked in yet)
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
          this.logger.log(`📅 Check-in date from DB: ${booking.checkIn}`);
          this.logger.log(`📅 Check-out date from DB: ${booking.checkOut}`);

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

          // ✅ Send email notification for check-in with FULL booking data
          if (booking.email) {
            // ✅ Ensure dates are properly formatted
            const checkInDate = booking.checkIn ? new Date(booking.checkIn) : null;
            const checkOutDate = booking.checkOut ? new Date(booking.checkOut) : null;
            
            const emailData = {
              guestName: booking.agentName || 'Guest',
              bookingNo: booking.bookingNo || 'N/A',
              checkInDate: checkInDate,
              checkOutDate: checkOutDate,
              roomType: booking.roomType || 'N/A',
              branch: booking.branch || 'N/A',
              totalCost: booking.totalCost || 0,
              agentName: booking.agentName || 'Guest',
            };
            
            this.logger.log(`📧 Sending check-in confirmation email to ${booking.email}`);
            this.logger.log(`📧 Email data: ${JSON.stringify(emailData)}`);
            
            await this.emailService.sendEmail({
              to: booking.email,
              subject: `Check-in Confirmation - ${booking.bookingNo}`,
              template: 'checkin_confirmation',
              data: emailData,
            });
          }

          checkedIn++;
          checkedInBookings.push(updated);
          this.logger.log(`✅ Checked in: ${booking.bookingNo} - ${booking.agentName}`);
        } catch (error) {
          this.logger.error(`❌ Error checking in ${booking.bookingNo}:`, error);
        }
      }

      // ✅ 2. PROCESS CHECKOUT REMINDERS (ONLY for guests who just checked in TODAY)
      const justCheckedInBookings = checkedInBookings;
      
      // Also get bookings that were already checked in today (from previous auto check-ins)
      const alreadyCheckedInToday = allBookings.filter(b => {
        const checkIn = new Date(b.checkIn);
        checkIn.setHours(0, 0, 0, 0);
        const isToday = checkIn.getTime() === today.getTime();
        const isCheckedIn = b.bookingStatus === 'CheckedIn';
        const hasActualCheckIn = b.actualCheckIn && new Date(b.actualCheckIn).getDate() === today.getDate();
        return isToday && isCheckedIn && hasActualCheckIn;
      });

      // Combine both lists - only guests who checked in today
      const allCheckedInToday = [...justCheckedInBookings, ...alreadyCheckedInToday];
      
      // Remove duplicates based on id
      const uniqueCheckedInToday = allCheckedInToday.filter((booking, index, self) => 
        index === self.findIndex(b => b.id === booking.id)
      );

      this.logger.log(`📋 Found ${uniqueCheckedInToday.length} guests who checked in today`);

      // ✅ Filter for checkout reminders (only for guests who checked in today)
      const checkoutReminderBookings = uniqueCheckedInToday.filter(b => {
        const checkOut = new Date(b.checkOut);
        checkOut.setHours(0, 0, 0, 0);
        const isTomorrow = checkOut.getTime() === tomorrow.getTime();
        const isDayAfter = checkOut.getTime() === dayAfterTomorrow.getTime();
        const notReminded = !b.checkoutReminderSent;
        return (isTomorrow || isDayAfter) && notReminded;
      });

      this.logger.log(`📋 Found ${checkoutReminderBookings.length} checkout reminders to send for today's check-ins`);

      let checkoutReminderCount = 0;

      for (const booking of checkoutReminderBookings) {
        try {
          const checkOutDate = new Date(booking.checkOut);
          const now = new Date();
          const daysUntilCheckout = Math.ceil((checkOutDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          // Calculate hours and minutes remaining for more precise reminder
          const diffMs = checkOutDate.getTime() - now.getTime();
          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
          const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          
          let timeUntilCheckout = '';
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
          
          const dayText = daysUntilCheckout === 1 ? 'tomorrow' : `in ${daysUntilCheckout} days`;

          // ✅ Create system notification for checkout reminder
          await this.prisma.notification.create({
            data: {
              title: `📤 Checkout Reminder - ${daysUntilCheckout} day${daysUntilCheckout > 1 ? 's' : ''}`,
              message: `${booking.agentName} (${booking.bookingNo}) will check out ${dayText} at ${booking.branch}. Room will be vacant.`,
              branch: booking.branch,
              bookingId: booking.id,
              type: 'checkout_reminder',
              isRead: false,
              createdAt: new Date(),
            },
          });

          // ✅ Send email notification to guest for checkout reminder with FULL data
          if (booking.email) {
            // ✅ Ensure dates are properly formatted
            const checkInDate = booking.checkIn ? new Date(booking.checkIn) : null;
            const checkOutDate = booking.checkOut ? new Date(booking.checkOut) : null;
            
            const emailData = {
              guestName: booking.agentName || 'Guest',
              bookingNo: booking.bookingNo || 'N/A',
              checkInDate: checkInDate,
              checkOutDate: checkOutDate,
              roomType: booking.roomType || 'N/A',
              branch: booking.branch || 'N/A',
              daysUntilCheckout: daysUntilCheckout,
              timeUntilCheckout: timeUntilCheckout,
              agentName: booking.agentName || 'Guest',
            };
            
            this.logger.log(`📧 Sending checkout reminder email to ${booking.email}`);
            this.logger.log(`📧 Email data: ${JSON.stringify(emailData)}`);
            
            await this.emailService.sendEmail({
              to: booking.email,
              subject: `Checkout Reminder - ${booking.bookingNo}`,
              template: 'checkout_reminder',
              data: emailData,
            });
          }

          // ✅ Send email to manager/admin about room vacating
          if (user.email) {
            const managerData = {
              guestName: booking.agentName || 'Guest',
              bookingNo: booking.bookingNo || 'N/A',
              checkOutDate: booking.checkOut || null,
              daysUntilCheckout: daysUntilCheckout,
              branch: booking.branch || 'N/A',
            };
            
            await this.emailService.sendEmail({
              to: user.email,
              subject: `📋 Room Vacating Alert - ${booking.bookingNo}`,
              template: 'manager_checkout_alert',
              data: managerData,
            });
          }

          // ✅ Mark that checkout reminder has been sent
          await this.prisma.booking.update({
            where: { id: booking.id },
            data: {
              checkoutReminderSent: true,
            },
          });

          checkoutReminderCount++;
          this.logger.log(`📤 Checkout reminder sent for: ${booking.bookingNo} - ${booking.agentName} (${timeUntilCheckout})`);
        } catch (error) {
          this.logger.error(`❌ Error sending checkout reminder for ${booking.bookingNo}:`, error);
        }
      }

      // ✅ 3. PROCESS CHECK-IN REMINDERS (Tomorrow's check-ins)
      const tomorrowCheckins = allBookings.filter(b => {
        const checkIn = new Date(b.checkIn);
        checkIn.setHours(0, 0, 0, 0);
        const isTomorrow = checkIn.getTime() === tomorrow.getTime();
        return isTomorrow && b.bookingStatus === 'Confirm' && !b.checkinReminderSent;
      });

      this.logger.log(`📋 Found ${tomorrowCheckins.length} check-in reminders to send`);

      let checkinReminderCount = 0;

      for (const booking of tomorrowCheckins) {
        try {
          // ✅ Create system notification for check-in reminder
          await this.prisma.notification.create({
            data: {
              title: '📅 Check-in Tomorrow',
              message: `${booking.agentName} (${booking.bookingNo}) is scheduled to check-in tomorrow at ${booking.branch}.`,
              branch: booking.branch,
              bookingId: booking.id,
              type: 'checkin_reminder',
              isRead: false,
              createdAt: new Date(),
            },
          });

          // ✅ Send email notification for check-in reminder with FULL data
          if (booking.email) {
            const checkInDate = booking.checkIn ? new Date(booking.checkIn) : null;
            const checkOutDate = booking.checkOut ? new Date(booking.checkOut) : null;
            
            const emailData = {
              guestName: booking.agentName || 'Guest',
              bookingNo: booking.bookingNo || 'N/A',
              checkInDate: checkInDate,
              checkOutDate: checkOutDate,
              roomType: booking.roomType || 'N/A',
              branch: booking.branch || 'N/A',
              agentName: booking.agentName || 'Guest',
            };
            
            await this.emailService.sendEmail({
              to: booking.email,
              subject: `Check-in Reminder - ${booking.bookingNo}`,
              template: 'checkin_reminder',
              data: emailData,
            });
          }

          // ✅ Mark that check-in reminder has been sent
          await this.prisma.booking.update({
            where: { id: booking.id },
            data: {
              checkinReminderSent: true,
            },
          });

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

          await this.prisma.notification.create({
            data: {
              title: '📤 Auto Check-out',
              message: `${booking.agentName} (${booking.bookingNo}) has checked out from ${booking.branch}. Room is now vacant.`,
              branch: booking.branch,
              bookingId: booking.id,
              type: 'checkout_success',
              isRead: false,
              createdAt: new Date(),
            },
          });

          // ✅ Send email notification for check-out with FULL data
          if (booking.email) {
            const checkOutDate = booking.checkOut ? new Date(booking.checkOut) : null;
            
            const emailData = {
              guestName: booking.agentName || 'Guest',
              bookingNo: booking.bookingNo || 'N/A',
              checkOutDate: checkOutDate,
              branch: booking.branch || 'N/A',
              agentName: booking.agentName || 'Guest',
            };
            
            await this.emailService.sendEmail({
              to: booking.email,
              subject: `Check-out Confirmation - ${booking.bookingNo}`,
              template: 'checkout_confirmation',
              data: emailData,
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

      let branch = user.branch || user.selectedBranch;
      
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

      let branch = user.branch || user.selectedBranch;
      
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