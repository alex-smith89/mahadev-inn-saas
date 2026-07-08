// backend/routes/automation.js (or wherever you keep your routes)
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ✅ Main automation run endpoint
router.post('/run', async (req, res) => {
  console.log('🚀 Automation run API called');
  
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - No token provided'
      });
    }

    // Get user from token (adjust based on your auth system)
    const user = await prisma.user.findFirst({
      where: { token: token }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Run the automation
    const results = await runFullAutomation(user);
    
    console.log('✅ Automation completed successfully');
    
    res.json({
      success: true,
      data: results,
      message: 'Automation completed successfully',
    });
    
  } catch (error) {
    console.error('❌ Error running automation:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to run automation',
    });
  }
});

// ✅ Auto check-in endpoint
router.post('/checkin', async (req, res) => {
  console.log('🔄 Auto check-in API called');
  
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const user = await prisma.user.findFirst({
      where: { token: token }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const userBranches = user.branches || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const bookingsToCheckin = await prisma.booking.findMany({
      where: {
        branch: {
          in: userBranches,
        },
        bookingStatus: {
          in: ['Confirm', 'Confirmed', 'Pending'],
        },
        checkIn: {
          lte: today,
        },
      },
    });

    let checkedIn = 0;
    let emailsSent = 0;

    for (const booking of bookingsToCheckin) {
      try {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { bookingStatus: 'CheckedIn' },
        });
        
        // Create notification
        await prisma.notification.create({
          data: {
            title: '🔄 Automated Check-in',
            message: `Guest ${booking.agentName} (${booking.bookingNo}) has been automatically checked in at ${booking.branch}.`,
            branch: booking.branch,
            bookingId: booking.id,
            type: 'auto_checkin',
          },
        });
        
        checkedIn++;
      } catch (error) {
        console.error(`Error checking in booking ${booking.id}:`, error);
      }
    }

    res.json({
      success: true,
      data: { checkedIn, emailsSent },
    });
  } catch (error) {
    console.error('Error in check-in automation:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ✅ Auto check-out endpoint
router.post('/checkout', async (req, res) => {
  console.log('🔄 Auto checkout API called');
  
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const user = await prisma.user.findFirst({
      where: { token: token }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const userBranches = user.branches || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const bookingsToCheckout = await prisma.booking.findMany({
      where: {
        branch: {
          in: userBranches,
        },
        bookingStatus: {
          in: ['Confirm', 'Confirmed', 'CheckedIn'],
        },
        checkOut: {
          lte: today,
        },
      },
    });

    let checkedOut = 0;
    let emailsSent = 0;

    for (const booking of bookingsToCheckout) {
      try {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { bookingStatus: 'CheckedOut' },
        });
        
        await prisma.notification.create({
          data: {
            title: '📤 Automated Checkout',
            message: `Guest ${booking.agentName} (${booking.bookingNo}) has been automatically checked out from ${booking.branch}. Room is now vacant.`,
            branch: booking.branch,
            bookingId: booking.id,
            type: 'auto_checkout',
          },
        });
        
        checkedOut++;
      } catch (error) {
        console.error(`Error checking out booking ${booking.id}:`, error);
      }
    }

    res.json({
      success: true,
      data: { checkedOut, emailsSent },
    });
  } catch (error) {
    console.error('Error in checkout automation:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ✅ Reminders endpoint
router.post('/reminders', async (req, res) => {
  console.log('📧 Reminders API called');
  
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const user = await prisma.user.findFirst({
      where: { token: token }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const userBranches = user.branches || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let reminders = 0;
    let checkinReminders = 0;

    // Checkout reminders (1-3 days)
    const bookingsWithCheckout = await prisma.booking.findMany({
      where: {
        branch: {
          in: userBranches,
        },
        bookingStatus: {
          in: ['Confirm', 'Confirmed', 'CheckedIn'],
        },
        checkOut: {
          gte: today,
        },
      },
    });

    for (const booking of bookingsWithCheckout) {
      const checkOutDate = new Date(booking.checkOut);
      checkOutDate.setHours(0, 0, 0, 0);
      
      const daysUntilCheckout = Math.ceil((checkOutDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilCheckout > 0 && daysUntilCheckout <= 3) {
        try {
          await prisma.notification.create({
            data: {
              title: `📅 Checkout Reminder - ${daysUntilCheckout} day${daysUntilCheckout > 1 ? 's' : ''}`,
              message: `Guest ${booking.agentName} (${booking.bookingNo}) has checkout in ${daysUntilCheckout} days at ${booking.branch}.`,
              branch: booking.branch,
              bookingId: booking.id,
              type: 'checkout_reminder',
            },
          });
          reminders++;
        } catch (error) {
          console.error(`Error creating checkout reminder:`, error);
        }
      }
    }

    // Check-in reminders (tomorrow)
    const bookingsWithCheckin = await prisma.booking.findMany({
      where: {
        branch: {
          in: userBranches,
        },
        bookingStatus: {
          in: ['Confirm', 'Confirmed', 'Pending'],
        },
        checkIn: {
          gte: tomorrow,
          lt: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    for (const booking of bookingsWithCheckin) {
      try {
        await prisma.notification.create({
          data: {
            title: '📅 Check-in Tomorrow',
            message: `Guest ${booking.agentName} (${booking.bookingNo}) is scheduled to check-in tomorrow at ${booking.branch}.`,
            branch: booking.branch,
            bookingId: booking.id,
            type: 'checkin_reminder',
          },
        });
        checkinReminders++;
      } catch (error) {
        console.error(`Error creating check-in reminder:`, error);
      }
    }

    res.json({
      success: true,
      data: { reminders, checkinReminders },
    });
  } catch (error) {
    console.error('Error sending reminders:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ✅ The main automation function
async function runFullAutomation(user) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const userBranches = user.branches || [];
  
  console.log(`📋 User branches: ${userBranches.join(', ')}`);
  
  // Get all active bookings for user's branches
  const activeBookings = await prisma.booking.findMany({
    where: {
      branch: {
        in: userBranches,
      },
      bookingStatus: {
        in: ['Confirm', 'Confirmed', 'Pending', 'CheckedIn'],
      },
    },
  });

  console.log(`📋 Found ${activeBookings.length} active bookings`);

  const results = {
    notifications: {
      checkinToday: [],
      checkinTomorrow: [],
      checkoutToday: [],
      checkoutTomorrow: [],
      checkoutIn2Days: [],
      checkoutIn3Days: [],
    },
    checkins: { checkedIn: 0 },
    checkouts: { checkedOut: 0 },
    reminders: { reminders: 0 },
    checkinReminders: { reminders: 0 },
    timestamp: new Date().toISOString(),
  };

  let checkedInCount = 0;
  let checkedOutCount = 0;
  let reminderCount = 0;
  let checkinReminderCount = 0;

  for (const booking of activeBookings) {
    const checkInDate = new Date(booking.checkIn);
    checkInDate.setHours(0, 0, 0, 0);
    
    const checkOutDate = new Date(booking.checkOut);
    checkOutDate.setHours(0, 0, 0, 0);

    const daysUntilCheckin = Math.ceil((checkInDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const daysUntilCheckout = Math.ceil((checkOutDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`📋 Processing booking: ${booking.bookingNo} - ${booking.agentName}`);

    // Check-in Today
    if (daysUntilCheckin === 0 && booking.bookingStatus !== 'CheckedIn') {
      console.log(`✅ Check-in TODAY: ${booking.agentName}`);
      results.notifications.checkinToday.push(booking);
      checkedInCount++;
      
      try {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { bookingStatus: 'CheckedIn' },
        });
        
        await prisma.notification.create({
          data: {
            title: '🔔 Check-in Today',
            message: `Guest ${booking.agentName} (${booking.bookingNo}) is checking in TODAY at ${booking.branch}.`,
            branch: booking.branch,
            bookingId: booking.id,
            type: 'checkin_today',
          },
        });
      } catch (error) {
        console.error(`Error processing check-in for ${booking.agentName}:`, error);
      }
    }

    // Check-in Tomorrow
    if (daysUntilCheckin === 1) {
      console.log(`📅 Check-in TOMORROW: ${booking.agentName}`);
      results.notifications.checkinTomorrow.push(booking);
      checkinReminderCount++;
      
      try {
        await prisma.notification.create({
          data: {
            title: '📅 Check-in Tomorrow',
            message: `Guest ${booking.agentName} (${booking.bookingNo}) is checking in TOMORROW at ${booking.branch}.`,
            branch: booking.branch,
            bookingId: booking.id,
            type: 'checkin_tomorrow',
          },
        });
      } catch (error) {
        console.error(`Error creating check-in reminder:`, error);
      }
    }

    // Checkout Today
    if (daysUntilCheckout === 0 && booking.bookingStatus !== 'CheckedOut') {
      console.log(`📤 Checkout TODAY: ${booking.agentName}`);
      results.notifications.checkoutToday.push(booking);
      
      try {
        const currentHour = new Date().getHours();
        if (currentHour >= 12) {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { bookingStatus: 'CheckedOut' },
          });
          checkedOutCount++;
        }
        
        await prisma.notification.create({
          data: {
            title: '📤 Check-out Today',
            message: `Guest ${booking.agentName} (${booking.bookingNo}) is checking out TODAY at ${booking.branch}.`,
            branch: booking.branch,
            bookingId: booking.id,
            type: 'checkout_today',
          },
        });
      } catch (error) {
        console.error(`Error processing checkout for ${booking.agentName}:`, error);
      }
    }

    // Checkout Tomorrow
    if (daysUntilCheckout === 1) {
      console.log(`📅 Checkout TOMORROW: ${booking.agentName}`);
      results.notifications.checkoutTomorrow.push(booking);
      reminderCount++;
      
      try {
        await prisma.notification.create({
          data: {
            title: '📅 Check-out Tomorrow',
            message: `Guest ${booking.agentName} (${booking.bookingNo}) is checking out TOMORROW at ${booking.branch}.`,
            branch: booking.branch,
            bookingId: booking.id,
            type: 'checkout_tomorrow',
          },
        });
      } catch (error) {
        console.error(`Error creating checkout reminder:`, error);
      }
    }

    // Checkout in 2 days
    if (daysUntilCheckout === 2) {
      console.log(`📅 Checkout in 2 days: ${booking.agentName}`);
      results.notifications.checkoutIn2Days.push(booking);
      reminderCount++;
      
      try {
        await prisma.notification.create({
          data: {
            title: '📅 Check-out in 2 days',
            message: `Guest ${booking.agentName} (${booking.bookingNo}) is checking out in 2 days at ${booking.branch}.`,
            branch: booking.branch,
            bookingId: booking.id,
            type: 'checkout_2days',
          },
        });
      } catch (error) {
        console.error(`Error creating 2-day reminder:`, error);
      }
    }

    // Checkout in 3 days
    if (daysUntilCheckout === 3) {
      console.log(`📅 Checkout in 3 days: ${booking.agentName}`);
      results.notifications.checkoutIn3Days.push(booking);
      reminderCount++;
      
      try {
        await prisma.notification.create({
          data: {
            title: '📅 Check-out in 3 days',
            message: `Guest ${booking.agentName} (${booking.bookingNo}) is checking out in 3 days at ${booking.branch}.`,
            branch: booking.branch,
            bookingId: booking.id,
            type: 'checkout_3days',
          },
        });
      } catch (error) {
        console.error(`Error creating 3-day reminder:`, error);
      }
    }

    // Overdue checkout
    if (daysUntilCheckout < 0 && booking.bookingStatus !== 'CheckedOut') {
      console.log(`⚠️ Overdue checkout: ${booking.agentName}`);
      
      try {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { bookingStatus: 'CheckedOut' },
        });
        checkedOutCount++;
        
        await prisma.notification.create({
          data: {
            title: '🔄 Auto Checkout Completed',
            message: `Guest ${booking.agentName} (${booking.bookingNo}) has been automatically checked out from ${booking.branch}.`,
            branch: booking.branch,
            bookingId: booking.id,
            type: 'auto_checkout',
          },
        });
      } catch (error) {
        console.error(`Error processing overdue checkout:`, error);
      }
    }
  }

  results.checkins.checkedIn = checkedInCount;
  results.checkouts.checkedOut = checkedOutCount;
  results.reminders.reminders = reminderCount;
  results.checkinReminders.reminders = checkinReminderCount;

  return results;
}

module.exports = router;