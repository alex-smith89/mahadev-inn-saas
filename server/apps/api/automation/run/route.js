// src/app/api/automation/run/route.js
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ✅ This is the main automation handler
export async function POST(request) {
  console.log('🚀 Automation run API called');
  
  try {
    // Get authorization token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    console.log('🔑 Token received:', token ? 'Yes' : 'No');
    
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }

    // Get user from token
    const user = await prisma.user.findFirst({
      where: { token: token }
    });

    console.log('👤 User found:', user ? user.username : 'No user');

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 401 }
      );
    }

    // Run the automation
    const results = await runFullAutomation(user);
    
    console.log('✅ Automation completed successfully');
    
    return NextResponse.json({
      success: true,
      data: results,
      message: 'Automation completed successfully',
    });
    
  } catch (error) {
    console.error('❌ Error running automation:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error.message || 'Failed to run automation',
        error: error.stack 
      },
      { status: 500 }
    );
  }
}

// ✅ The main automation function
async function runFullAutomation(user) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Get user's branches
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

    // ✅ Check-in Today
    if (daysUntilCheckin === 0 && booking.bookingStatus !== 'CheckedIn') {
      console.log(`✅ Check-in TODAY: ${booking.agentName}`);
      results.notifications.checkinToday.push(booking);
      checkedInCount++;
      
      try {
        // Update booking status
        await prisma.booking.update({
          where: { id: booking.id },
          data: { bookingStatus: 'CheckedIn' },
        });
        console.log(`✅ Updated booking ${booking.bookingNo} to CheckedIn`);
        
        // Create notification
        await prisma.notification.create({
          data: {
            title: '🔔 Check-in Today',
            message: `Guest ${booking.agentName} (${booking.bookingNo}) is checking in TODAY at ${booking.branch}.`,
            branch: booking.branch,
            bookingId: booking.id,
            type: 'checkin_today',
          },
        });
        console.log(`📢 Created notification for ${booking.agentName}`);
      } catch (error) {
        console.error(`❌ Error processing check-in for ${booking.agentName}:`, error);
      }
    }

    // ✅ Check-in Tomorrow
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
        console.log(`📢 Created check-in reminder for ${booking.agentName}`);
      } catch (error) {
        console.error(`❌ Error creating check-in reminder:`, error);
      }
    }

    // ✅ Checkout Today
    if (daysUntilCheckout === 0 && booking.bookingStatus !== 'CheckedOut') {
      console.log(`📤 Checkout TODAY: ${booking.agentName}`);
      results.notifications.checkoutToday.push(booking);
      
      try {
        // Auto checkout after 12 PM
        const currentHour = new Date().getHours();
        if (currentHour >= 12) {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { bookingStatus: 'CheckedOut' },
          });
          checkedOutCount++;
          console.log(`✅ Auto checked out ${booking.agentName}`);
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
        console.log(`📢 Created checkout notification for ${booking.agentName}`);
      } catch (error) {
        console.error(`❌ Error processing checkout for ${booking.agentName}:`, error);
      }
    }

    // ✅ Checkout Tomorrow
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
        console.log(`📢 Created checkout reminder for ${booking.agentName}`);
      } catch (error) {
        console.error(`❌ Error creating checkout reminder:`, error);
      }
    }

    // ✅ Checkout in 2 days
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
        console.error(`❌ Error creating 2-day reminder:`, error);
      }
    }

    // ✅ Checkout in 3 days
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
        console.error(`❌ Error creating 3-day reminder:`, error);
      }
    }

    // ✅ Overdue checkout
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
        console.log(`✅ Auto checked out overdue ${booking.agentName}`);
      } catch (error) {
        console.error(`❌ Error processing overdue checkout:`, error);
      }
    }
  }

  results.checkins.checkedIn = checkedInCount;
  results.checkouts.checkedOut = checkedOutCount;
  results.reminders.reminders = reminderCount;
  results.checkinReminders.reminders = checkinReminderCount;

  console.log(`📊 Automation Summary:`);
  console.log(`   ✅ Checked in: ${checkedInCount}`);
  console.log(`   📤 Checked out: ${checkedOutCount}`);
  console.log(`   📧 Reminders sent: ${reminderCount}`);
  console.log(`   📧 Check-in reminders: ${checkinReminderCount}`);

  return results;
}