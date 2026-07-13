// src/automation/automation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(private prisma: PrismaService) {}

  // ✅ RUN FULL AUTOMATION
  async runFullAutomation(user: any) {
    try {
      const userBranches = user.branches || [];
      const selectedBranch = user.selectedBranch;
      const canViewAllBranches = user.canViewAllBranches || user.role === 'OWNER' || user.role === 'MANAGER';

      // ✅ Determine target branches
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

      this.logger.log(`📋 Running full automation for branches: ${targetBranches.join(', ')}`);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const results = {
        checkins: { checkedIn: 0 },
        checkouts: { checkedOut: 0 },
        reminders: { checkoutReminders: 0, checkinReminders: 0 },
        notifications: {
          checkinToday: [],
          checkinTomorrow: [],
          checkoutToday: [],
          checkoutTomorrow: [],
          checkoutIn2Days: [],
          checkoutIn3Days: [],
        },
        timestamp: new Date().toISOString(),
        branches: targetBranches,
      };

      let checkedInCount = 0;
      let checkedOutCount = 0;
      let checkoutReminderCount = 0;
      let checkinReminderCount = 0;

      // ✅ Get all active bookings for target branches
      const bookings = await this.prisma.booking.findMany({
        where: {
          branch: { in: targetBranches },
          bookingStatus: { in: ['Confirm', 'Confirmed', 'Pending', 'CheckedIn'] },
        },
      });

      this.logger.log(`📋 Found ${bookings.length} active bookings`);

      for (const booking of bookings) {
        const checkInDate = new Date(booking.checkIn);
        checkInDate.setHours(0, 0, 0, 0);
        
        const checkOutDate = new Date(booking.checkOut);
        checkOutDate.setHours(0, 0, 0, 0);

        const daysUntilCheckin = Math.ceil((checkInDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const daysUntilCheckout = Math.ceil((checkOutDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // ✅ Check-in Today
        if (daysUntilCheckin === 0 && booking.bookingStatus !== 'CheckedIn') {
          this.logger.log(`✅ Check-in TODAY: ${booking.agentName} (${booking.branch})`);
          results.notifications.checkinToday.push(booking);
          checkedInCount++;
          
          try {
            await this.prisma.booking.update({
              where: { id: booking.id },
              data: {
                bookingStatus: 'CheckedIn',
                updatedAt: new Date(),
              },
            });
            
            await this.prisma.notification.create({
              data: {
                title: '🔔 Check-in Today',
                message: `Guest ${booking.agentName} (${booking.bookingNo}) is checking in TODAY at ${booking.branch}.`,
                branch: booking.branch,
                bookingId: booking.id,
                type: 'checkin_today',
                createdAt: new Date(),
              },
            });
          } catch (error) {
            this.logger.error(`Error processing check-in for ${booking.agentName}:`, error);
          }
        }

        // ✅ Check-in Tomorrow
        if (daysUntilCheckin === 1) {
          this.logger.log(`📅 Check-in TOMORROW: ${booking.agentName} (${booking.branch})`);
          results.notifications.checkinTomorrow.push(booking);
          checkinReminderCount++;
          
          try {
            await this.prisma.notification.create({
              data: {
                title: '📅 Check-in Tomorrow',
                message: `Guest ${booking.agentName} (${booking.bookingNo}) is checking in TOMORROW at ${booking.branch}.`,
                branch: booking.branch,
                bookingId: booking.id,
                type: 'checkin_tomorrow',
                createdAt: new Date(),
              },
            });
          } catch (error) {
            this.logger.error(`Error creating check-in reminder:`, error);
          }
        }

        // ✅ Checkout Today
        if (daysUntilCheckout === 0 && booking.bookingStatus !== 'CheckedOut') {
          this.logger.log(`📤 Checkout TODAY: ${booking.agentName} (${booking.branch})`);
          results.notifications.checkoutToday.push(booking);
          
          try {
            const currentHour = new Date().getHours();
            if (currentHour >= 12) {
              await this.prisma.booking.update({
                where: { id: booking.id },
                data: {
                  bookingStatus: 'CheckedOut',
                  updatedAt: new Date(),
                },
              });
              checkedOutCount++;
            }
            
            await this.prisma.notification.create({
              data: {
                title: '📤 Check-out Today',
                message: `Guest ${booking.agentName} (${booking.bookingNo}) is checking out TODAY at ${booking.branch}.`,
                branch: booking.branch,
                bookingId: booking.id,
                type: 'checkout_today',
                createdAt: new Date(),
              },
            });
          } catch (error) {
            this.logger.error(`Error processing checkout for ${booking.agentName}:`, error);
          }
        }

        // ✅ Checkout Tomorrow
        if (daysUntilCheckout === 1) {
          this.logger.log(`📅 Checkout TOMORROW: ${booking.agentName} (${booking.branch})`);
          results.notifications.checkoutTomorrow.push(booking);
          checkoutReminderCount++;
          
          try {
            await this.prisma.notification.create({
              data: {
                title: '📅 Check-out Tomorrow',
                message: `Guest ${booking.agentName} (${booking.bookingNo}) is checking out TOMORROW at ${booking.branch}.`,
                branch: booking.branch,
                bookingId: booking.id,
                type: 'checkout_tomorrow',
                createdAt: new Date(),
              },
            });
          } catch (error) {
            this.logger.error(`Error creating checkout reminder:`, error);
          }
        }

        // ✅ Checkout in 2 days
        if (daysUntilCheckout === 2) {
          this.logger.log(`📅 Checkout in 2 days: ${booking.agentName} (${booking.branch})`);
          results.notifications.checkoutIn2Days.push(booking);
          checkoutReminderCount++;
          
          try {
            await this.prisma.notification.create({
              data: {
                title: '📅 Check-out in 2 days',
                message: `Guest ${booking.agentName} (${booking.bookingNo}) is checking out in 2 days at ${booking.branch}.`,
                branch: booking.branch,
                bookingId: booking.id,
                type: 'checkout_2days',
                createdAt: new Date(),
              },
            });
          } catch (error) {
            this.logger.error(`Error creating 2-day reminder:`, error);
          }
        }

        // ✅ Checkout in 3 days
        if (daysUntilCheckout === 3) {
          this.logger.log(`📅 Checkout in 3 days: ${booking.agentName} (${booking.branch})`);
          results.notifications.checkoutIn3Days.push(booking);
          checkoutReminderCount++;
          
          try {
            await this.prisma.notification.create({
              data: {
                title: '📅 Check-out in 3 days',
                message: `Guest ${booking.agentName} (${booking.bookingNo}) is checking out in 3 days at ${booking.branch}.`,
                branch: booking.branch,
                bookingId: booking.id,
                type: 'checkout_3days',
                createdAt: new Date(),
              },
            });
          } catch (error) {
            this.logger.error(`Error creating 3-day reminder:`, error);
          }
        }

        // ✅ Overdue checkout
        if (daysUntilCheckout < 0 && booking.bookingStatus !== 'CheckedOut') {
          this.logger.log(`⚠️ Overdue checkout: ${booking.agentName} (${booking.branch})`);
          
          try {
            await this.prisma.booking.update({
              where: { id: booking.id },
              data: {
                bookingStatus: 'CheckedOut',
                updatedAt: new Date(),
              },
            });
            checkedOutCount++;
            
            await this.prisma.notification.create({
              data: {
                title: '🔄 Auto Checkout Completed',
                message: `Guest ${booking.agentName} (${booking.bookingNo}) has been automatically checked out from ${booking.branch}.`,
                branch: booking.branch,
                bookingId: booking.id,
                type: 'auto_checkout',
                createdAt: new Date(),
              },
            });
          } catch (error) {
            this.logger.error(`Error processing overdue checkout:`, error);
          }
        }
      }

      results.checkins.checkedIn = checkedInCount;
      results.checkouts.checkedOut = checkedOutCount;
      results.reminders.checkoutReminders = checkoutReminderCount;
      results.reminders.checkinReminders = checkinReminderCount;

      this.logger.log(`📊 Full Automation Summary:`);
      this.logger.log(`   ✅ Checked in: ${checkedInCount}`);
      this.logger.log(`   📤 Checked out: ${checkedOutCount}`);
      this.logger.log(`   📧 Checkout reminders: ${checkoutReminderCount}`);
      this.logger.log(`   📧 Check-in reminders: ${checkinReminderCount}`);

      return results;
    } catch (error) {
      this.logger.error('❌ Error in full automation:', error);
      throw error;
    }
  }

  // ✅ RUN AUTO CHECK-IN ONLY
  async runAutoCheckin(user: any) {
    try {
      const userBranches = user.branches || [];
      const selectedBranch = user.selectedBranch;
      const canViewAllBranches = user.canViewAllBranches || user.role === 'OWNER' || user.role === 'MANAGER';

      // ✅ Determine target branches
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

      this.logger.log(`📋 Running auto check-in for branches: ${targetBranches.join(', ')}`);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // ✅ Find bookings to check in
      const bookingsToCheckIn = await this.prisma.booking.findMany({
        where: {
          branch: { in: targetBranches },
          bookingStatus: { in: ['Confirm', 'Confirmed', 'Pending'] },
          checkIn: { lte: today },
        },
      });

      this.logger.log(`📋 Found ${bookingsToCheckIn.length} bookings to check in`);

      let checkedIn = 0;
      const checkedInBookings = [];

      for (const booking of bookingsToCheckIn) {
        try {
          await this.prisma.booking.update({
            where: { id: booking.id },
            data: {
              bookingStatus: 'CheckedIn',
              updatedAt: new Date(),
            },
          });

          await this.prisma.notification.create({
            data: {
              title: '🔄 Automated Check-in',
              message: `Guest ${booking.agentName} (${booking.bookingNo}) has been automatically checked in at ${booking.branch}.`,
              branch: booking.branch,
              bookingId: booking.id,
              type: 'auto_checkin',
              createdAt: new Date(),
            },
          });

          checkedIn++;
          checkedInBookings.push(booking);
          this.logger.log(`✅ Checked in: ${booking.agentName} (${booking.bookingNo}) at ${booking.branch}`);
        } catch (error) {
          this.logger.error(`Error checking in booking ${booking.id}:`, error);
        }
      }

      return {
        checkedIn: checkedIn,
        bookings: checkedInBookings,
        branches: targetBranches,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error in auto check-in:', error);
      throw error;
    }
  }

  // ✅ RUN AUTO CHECK-OUT ONLY
  async runAutoCheckout(user: any) {
    try {
      const userBranches = user.branches || [];
      const selectedBranch = user.selectedBranch;
      const canViewAllBranches = user.canViewAllBranches || user.role === 'OWNER' || user.role === 'MANAGER';

      // ✅ Determine target branches
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

      this.logger.log(`📋 Running auto check-out for branches: ${targetBranches.join(', ')}`);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // ✅ Find bookings to check out
      const bookingsToCheckOut = await this.prisma.booking.findMany({
        where: {
          branch: { in: targetBranches },
          bookingStatus: { in: ['Confirm', 'Confirmed', 'CheckedIn'] },
          checkOut: { lte: today },
        },
      });

      this.logger.log(`📋 Found ${bookingsToCheckOut.length} bookings to check out`);

      let checkedOut = 0;
      const checkedOutBookings = [];

      for (const booking of bookingsToCheckOut) {
        try {
          await this.prisma.booking.update({
            where: { id: booking.id },
            data: {
              bookingStatus: 'CheckedOut',
              updatedAt: new Date(),
            },
          });

          await this.prisma.notification.create({
            data: {
              title: '📤 Automated Checkout',
              message: `Guest ${booking.agentName} (${booking.bookingNo}) has been automatically checked out from ${booking.branch}. Room is now vacant.`,
              branch: booking.branch,
              bookingId: booking.id,
              type: 'auto_checkout',
              createdAt: new Date(),
            },
          });

          checkedOut++;
          checkedOutBookings.push(booking);
          this.logger.log(`✅ Checked out: ${booking.agentName} (${booking.bookingNo}) from ${booking.branch}`);
        } catch (error) {
          this.logger.error(`Error checking out booking ${booking.id}:`, error);
        }
      }

      return {
        checkedOut: checkedOut,
        bookings: checkedOutBookings,
        branches: targetBranches,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error in auto check-out:', error);
      throw error;
    }
  }

  // ✅ SEND REMINDERS ONLY
  async sendReminders(user: any) {
    try {
      const userBranches = user.branches || [];
      const selectedBranch = user.selectedBranch;
      const canViewAllBranches = user.canViewAllBranches || user.role === 'OWNER' || user.role === 'MANAGER';

      // ✅ Determine target branches
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

      this.logger.log(`📋 Sending reminders for branches: ${targetBranches.join(', ')}`);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let checkoutReminders = 0;
      let checkinReminders = 0;

      // ✅ Checkout reminders (1-3 days)
      const checkoutBookings = await this.prisma.booking.findMany({
        where: {
          branch: { in: targetBranches },
          bookingStatus: { in: ['Confirm', 'Confirmed', 'CheckedIn'] },
          checkOut: { gte: today, lte: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000) },
        },
      });

      for (const booking of checkoutBookings) {
        const checkOutDate = new Date(booking.checkOut);
        checkOutDate.setHours(0, 0, 0, 0);
        const daysUntilCheckout = Math.ceil((checkOutDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilCheckout > 0 && daysUntilCheckout <= 3) {
          await this.prisma.notification.create({
            data: {
              title: `📅 Checkout Reminder - ${daysUntilCheckout} day${daysUntilCheckout > 1 ? 's' : ''}`,
              message: `Guest ${booking.agentName} (${booking.bookingNo}) has checkout in ${daysUntilCheckout} days at ${booking.branch}.`,
              branch: booking.branch,
              bookingId: booking.id,
              type: 'checkout_reminder',
              createdAt: new Date(),
            },
          });
          checkoutReminders++;
        }
      }

      // ✅ Check-in reminders (tomorrow)
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      const checkinBookings = await this.prisma.booking.findMany({
        where: {
          branch: { in: targetBranches },
          bookingStatus: { in: ['Confirm', 'Confirmed', 'Pending'] },
          checkIn: { gte: tomorrow, lt: dayAfterTomorrow },
        },
      });

      for (const booking of checkinBookings) {
        await this.prisma.notification.create({
          data: {
            title: '📅 Check-in Tomorrow',
            message: `Guest ${booking.agentName} (${booking.bookingNo}) is scheduled to check-in tomorrow at ${booking.branch}.`,
            branch: booking.branch,
            bookingId: booking.id,
            type: 'checkin_reminder',
            createdAt: new Date(),
          },
        });
        checkinReminders++;
      }

      this.logger.log(`📧 Sent ${checkoutReminders} checkout reminders and ${checkinReminders} check-in reminders`);

      return {
        checkoutReminders: checkoutReminders,
        checkinReminders: checkinReminders,
        branches: targetBranches,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error sending reminders:', error);
      throw error;
    }
  }

  // ✅ GET AUTOMATION STATUS
  async getAutomationStatus(user: any) {
    try {
      const userBranches = user.branches || [];
      const selectedBranch = user.selectedBranch;
      const canViewAllBranches = user.canViewAllBranches || user.role === 'OWNER' || user.role === 'MANAGER';

      // ✅ Determine target branches
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

      // ✅ Count bookings for automation
      const [checkinToday, checkinTomorrow, checkoutToday, checkoutTomorrow, overdueCheckouts] = await Promise.all([
        this.prisma.booking.count({
          where: {
            branch: { in: targetBranches },
            bookingStatus: { in: ['Confirm', 'Confirmed', 'Pending'] },
            checkIn: { gte: today, lt: tomorrow },
          },
        }),
        this.prisma.booking.count({
          where: {
            branch: { in: targetBranches },
            bookingStatus: { in: ['Confirm', 'Confirmed', 'Pending'] },
            checkIn: { gte: tomorrow, lt: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000) },
          },
        }),
        this.prisma.booking.count({
          where: {
            branch: { in: targetBranches },
            bookingStatus: { in: ['Confirm', 'Confirmed', 'CheckedIn'] },
            checkOut: { gte: today, lt: tomorrow },
          },
        }),
        this.prisma.booking.count({
          where: {
            branch: { in: targetBranches },
            bookingStatus: { in: ['Confirm', 'Confirmed', 'CheckedIn'] },
            checkOut: { gte: tomorrow, lt: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000) },
          },
        }),
        this.prisma.booking.count({
          where: {
            branch: { in: targetBranches },
            bookingStatus: { in: ['Confirm', 'Confirmed', 'CheckedIn'] },
            checkOut: { lt: today },
          },
        }),
      ]);

      return {
        branches: targetBranches,
        summary: {
          checkinToday,
          checkinTomorrow,
          checkoutToday,
          checkoutTomorrow,
          overdueCheckouts,
        },
        date: today.toISOString(),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error getting automation status:', error);
      throw error;
    }
  }

  // ✅ GET TODAY'S AUTOMATION SUMMARY
  async getTodaySummary(user: any) {
    try {
      const userBranches = user.branches || [];
      const selectedBranch = user.selectedBranch;
      const canViewAllBranches = user.canViewAllBranches || user.role === 'OWNER' || user.role === 'MANAGER';

      // ✅ Determine target branches
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

      // ✅ Get today's bookings
      const [checkins, checkouts] = await Promise.all([
        this.prisma.booking.findMany({
          where: {
            branch: { in: targetBranches },
            bookingStatus: { in: ['Confirm', 'Confirmed', 'Pending'] },
            checkIn: { gte: today, lt: tomorrow },
          },
          select: {
            id: true,
            bookingNo: true,
            agentName: true,
            roomType: true,
            branch: true,
            checkIn: true,
            checkOut: true,
          },
        }),
        this.prisma.booking.findMany({
          where: {
            branch: { in: targetBranches },
            bookingStatus: { in: ['Confirm', 'Confirmed', 'CheckedIn'] },
            checkOut: { gte: today, lt: tomorrow },
          },
          select: {
            id: true,
            bookingNo: true,
            agentName: true,
            roomType: true,
            branch: true,
            checkIn: true,
            checkOut: true,
          },
        }),
      ]);

      return {
        branches: targetBranches,
        date: today.toISOString(),
        checkins: {
          count: checkins.length,
          bookings: checkins,
        },
        checkouts: {
          count: checkouts.length,
          bookings: checkouts,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error getting today summary:', error);
      throw error;
    }
  }
}