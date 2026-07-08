// src/services/automationService.js
const { PrismaClient } = require('@prisma/client');
const emailService = require('./emailService');

const prisma = new PrismaClient();

class AutomationService {
  // ✅ Process All Date-Based Notifications
  async processDateBasedNotifications() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const dayAfterTomorrow = new Date(today);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      
      const threeDaysLater = new Date(today);
      threeDaysLater.setDate(threeDaysLater.getDate() + 3);

      const notifications = {
        checkinToday: [],
        checkinTomorrow: [],
        checkoutToday: [],
        checkoutTomorrow: [],
        checkoutIn2Days: [],
        checkoutIn3Days: [],
        roomVacant: [],
      };

      // ✅ Get all active bookings
      const activeBookings = await prisma.booking.findMany({
        where: {
          bookingStatus: {
            in: ['Confirm', 'Confirmed', 'Pending', 'CheckedIn'],
          },
        },
      });

      console.log(`📋 Processing ${activeBookings.length} active bookings for notifications`);

      for (const booking of activeBookings) {
        const checkInDate = new Date(booking.checkIn);
        checkInDate.setHours(0, 0, 0, 0);
        
        const checkOutDate = new Date(booking.checkOut);
        checkOutDate.setHours(0, 0, 0, 0);

        const daysUntilCheckin = Math.ceil((checkInDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const daysUntilCheckout = Math.ceil((checkOutDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // ✅ Check-in Notifications
        if (daysUntilCheckin === 0) {
          // Check-in TODAY
          notifications.checkinToday.push(booking);
          await this.handleCheckinToday(booking);
        } else if (daysUntilCheckin === 1) {
          // Check-in TOMORROW
          notifications.checkinTomorrow.push(booking);
          await this.handleCheckinTomorrow(booking);
        }

        // ✅ Check-out Notifications
        if (daysUntilCheckout === 0) {
          // Check-out TODAY
          notifications.checkoutToday.push(booking);
          await this.handleCheckoutToday(booking);
        } else if (daysUntilCheckout === 1) {
          // Check-out TOMORROW
          notifications.checkoutTomorrow.push(booking);
          await this.handleCheckoutTomorrow(booking);
        } else if (daysUntilCheckout === 2) {
          // Check-out in 2 days
          notifications.checkoutIn2Days.push(booking);
          await this.handleCheckoutIn2Days(booking);
        } else if (daysUntilCheckout === 3) {
          // Check-out in 3 days
          notifications.checkoutIn3Days.push(booking);
          await this.handleCheckoutIn3Days(booking);
        }

        // ✅ Check for overdue checkouts (auto-checkout)
        if (daysUntilCheckout < 0 && booking.bookingStatus !== 'CheckedOut') {
          await this.autoCheckout(booking);
          notifications.roomVacant.push(booking);
        }
      }

      // ✅ Update room availability
      await this.updateRoomAvailability();

      return {
        notifications,
        timestamp: new Date().toISOString(),
        totalProcessed: activeBookings.length,
      };
    } catch (error) {
      console.error('❌ Error processing date-based notifications:', error);
      throw error;
    }
  }

  // ✅ Handle Check-in Today
  async handleCheckinToday(booking) {
    try {
      console.log(`🔔 Check-in TODAY: ${booking.agentName} (${booking.bookingNo})`);

      // Send email to guest
      if (booking.email) {
        await emailService.sendCheckinDayNotification(booking, booking.email);
      }

      // Create system notification for staff
      await prisma.notification.create({
        data: {
          title: '🔔 Check-in Today',
          message: `Guest ${booking.agentName} (${booking.bookingNo}) is checking in TODAY at ${booking.branch}. Room ${booking.roomType} should be ready.`,
          branch: booking.branch,
          bookingId: booking.id,
          type: 'checkin_today',
        },
      });

      // Update booking status to CheckedIn
      await prisma.booking.update({
        where: { id: booking.id },
        data: { bookingStatus: 'CheckedIn' },
      });

      console.log(`✅ Check-in processed for ${booking.agentName}`);
    } catch (error) {
      console.error(`❌ Error handling check-in today for ${booking.id}:`, error);
    }
  }

  // ✅ Handle Check-in Tomorrow
  async handleCheckinTomorrow(booking) {
    try {
      console.log(`🔔 Check-in TOMORROW: ${booking.agentName} (${booking.bookingNo})`);

      // Send email to guest
      if (booking.email) {
        await emailService.sendCheckinReminder(booking, booking.email);
      }

      // Create system notification for staff
      await prisma.notification.create({
        data: {
          title: '📅 Check-in Tomorrow',
          message: `Guest ${booking.agentName} (${booking.bookingNo}) is checking in TOMORROW at ${booking.branch}. Room ${booking.roomType} should be prepared.`,
          branch: booking.branch,
          bookingId: booking.id,
          type: 'checkin_tomorrow',
        },
      });

      console.log(`✅ Check-in reminder sent for ${booking.agentName}`);
    } catch (error) {
      console.error(`❌ Error handling check-in tomorrow for ${booking.id}:`, error);
    }
  }

  // ✅ Handle Check-out Today
  async handleCheckoutToday(booking) {
    try {
      console.log(`🔔 Check-out TODAY: ${booking.agentName} (${booking.bookingNo})`);

      // Send email to guest
      if (booking.email) {
        await emailService.sendCheckoutDayNotification(booking, booking.email);
      }

      // Create system notification for staff
      await prisma.notification.create({
        data: {
          title: '📤 Check-out Today',
          message: `Guest ${booking.agentName} (${booking.bookingNo}) is checking out TODAY at ${booking.branch}. Room ${booking.roomType} will be vacant.`,
          branch: booking.branch,
          bookingId: booking.id,
          type: 'checkout_today',
        },
      });

      console.log(`✅ Check-out today notification sent for ${booking.agentName}`);
    } catch (error) {
      console.error(`❌ Error handling check-out today for ${booking.id}:`, error);
    }
  }

  // ✅ Handle Check-out Tomorrow
  async handleCheckoutTomorrow(booking) {
    try {
      console.log(`🔔 Check-out TOMORROW: ${booking.agentName} (${booking.bookingNo})`);

      // Send email to guest
      if (booking.email) {
        await emailService.sendCheckoutReminder(booking, booking.email, 1);
      }

      // Create system notification for staff
      await prisma.notification.create({
        data: {
          title: '📅 Check-out Tomorrow',
          message: `Guest ${booking.agentName} (${booking.bookingNo}) is checking out TOMORROW at ${booking.branch}. Please prepare the room for cleaning.`,
          branch: booking.branch,
          bookingId: booking.id,
          type: 'checkout_tomorrow',
        },
      });

      console.log(`✅ Check-out tomorrow notification sent for ${booking.agentName}`);
    } catch (error) {
      console.error(`❌ Error handling check-out tomorrow for ${booking.id}:`, error);
    }
  }

  // ✅ Handle Check-out in 2 days
  async handleCheckoutIn2Days(booking) {
    try {
      console.log(`🔔 Check-out in 2 days: ${booking.agentName} (${booking.bookingNo})`);

      if (booking.email) {
        await emailService.sendCheckoutReminder(booking, booking.email, 2);
      }

      await prisma.notification.create({
        data: {
          title: '📅 Check-out in 2 days',
          message: `Guest ${booking.agentName} (${booking.bookingNo}) is checking out in 2 days at ${booking.branch}.`,
          branch: booking.branch,
          bookingId: booking.id,
          type: 'checkout_2days',
        },
      });

      console.log(`✅ Check-out in 2 days notification sent for ${booking.agentName}`);
    } catch (error) {
      console.error(`❌ Error handling check-out in 2 days for ${booking.id}:`, error);
    }
  }

  // ✅ Handle Check-out in 3 days
  async handleCheckoutIn3Days(booking) {
    try {
      console.log(`🔔 Check-out in 3 days: ${booking.agentName} (${booking.bookingNo})`);

      if (booking.email) {
        await emailService.sendCheckoutReminder(booking, booking.email, 3);
      }

      await prisma.notification.create({
        data: {
          title: '📅 Check-out in 3 days',
          message: `Guest ${booking.agentName} (${booking.bookingNo}) is checking out in 3 days at ${booking.branch}.`,
          branch: booking.branch,
          bookingId: booking.id,
          type: 'checkout_3days',
        },
      });

      console.log(`✅ Check-out in 3 days notification sent for ${booking.agentName}`);
    } catch (error) {
      console.error(`❌ Error handling check-out in 3 days for ${booking.id}:`, error);
    }
  }

  // ✅ Auto Checkout (Overdue)
  async autoCheckout(booking) {
    try {
      console.log(`🔔 Auto-checkout: ${booking.agentName} (${booking.bookingNo})`);

      // Update booking status
      await prisma.booking.update({
        where: { id: booking.id },
        data: { bookingStatus: 'CheckedOut' },
      });

      // Send notification to staff
      await prisma.notification.create({
        data: {
          title: '🔄 Auto Checkout Completed',
          message: `Guest ${booking.agentName} (${booking.bookingNo}) has been automatically checked out from ${booking.roomType} at ${booking.branch}. Room is now vacant and requires cleaning.`,
          branch: booking.branch,
          bookingId: booking.id,
          type: 'auto_checkout',
        },
      });

      console.log(`✅ Auto-checkout completed for ${booking.agentName}`);
    } catch (error) {
      console.error(`❌ Error during auto-checkout for ${booking.id}:`, error);
    }
  }

  // ✅ Update Room Availability
  async updateRoomAvailability() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get all active bookings
      const activeBookings = await prisma.booking.findMany({
        where: {
          bookingStatus: {
            in: ['Confirm', 'Confirmed', 'CheckedIn'],
          },
          checkIn: {
            lte: today,
          },
          checkOut: {
            gt: today,
          },
        },
      });

      // Group by branch
      const branchOccupancy = {};
      activeBookings.forEach(booking => {
        if (!branchOccupancy[booking.branch]) {
          branchOccupancy[booking.branch] = 0;
        }
        branchOccupancy[booking.branch] += booking.roomsCount || 1;
      });

      console.log('📊 Updated room availability:', branchOccupancy);
      return branchOccupancy;
    } catch (error) {
      console.error('❌ Error updating room availability:', error);
      throw error;
    }
  }

  // ✅ Run Full Automation with Date-Based Notifications
  async runFullAutomation() {
    try {
      console.log('🚀 Starting full automation process...');

      // Process all date-based notifications
      const notificationResults = await this.processDateBasedNotifications();

      // Process automated check-ins (for any missed)
      const checkinResults = await this.processAutomatedCheckins();

      // Process automated checkouts (for overdue)
      const checkoutResults = await this.processAutomatedCheckouts();

      // Update room availability
      const roomAvailability = await this.updateRoomAvailability();

      return {
        notifications: notificationResults,
        checkins: checkinResults,
        checkouts: checkoutResults,
        roomAvailability,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ Error in full automation:', error);
      throw error;
    }
  }

  // ✅ Process Automated Check-ins (Legacy function - kept for compatibility)
  async processAutomatedCheckins() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const bookingsToCheckin = await prisma.booking.findMany({
        where: {
          bookingStatus: {
            in: ['Confirm', 'Confirmed', 'Pending'],
          },
          checkIn: {
            lte: today,
          },
        },
      });

      let checkedIn = 0;

      for (const booking of bookingsToCheckin) {
        try {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { bookingStatus: 'CheckedIn' },
          });
          checkedIn++;
        } catch (error) {
          console.error(`❌ Error checking in booking ${booking.id}:`, error);
        }
      }

      return { checkedIn };
    } catch (error) {
      console.error('❌ Error in automated check-in process:', error);
      throw error;
    }
  }

  // ✅ Process Automated Check-outs (Legacy function - kept for compatibility)
  async processAutomatedCheckouts() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const bookingsToCheckout = await prisma.booking.findMany({
        where: {
          bookingStatus: {
            in: ['Confirm', 'Confirmed', 'CheckedIn'],
          },
          checkOut: {
            lte: today,
          },
        },
      });

      let checkedOut = 0;

      for (const booking of bookingsToCheckout) {
        try {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { bookingStatus: 'CheckedOut' },
          });

          // Send room vacant notification
          await emailService.sendRoomVacantNotification(booking);
          checkedOut++;
        } catch (error) {
          console.error(`❌ Error checking out booking ${booking.id}:`, error);
        }
      }

      return { checkedOut };
    } catch (error) {
      console.error('❌ Error in automated checkout process:', error);
      throw error;
    }
  }
}

module.exports = new AutomationService();