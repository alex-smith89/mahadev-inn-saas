// src/app/api/automation/reminders/route.js
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request) {
  console.log('📧 Reminders API called');
  
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { token: token }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 401 }
      );
    }

    const userBranches = user.branches || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let reminders = 0;

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
          lte: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
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

    return NextResponse.json({
      success: true,
      data: { reminders },
    });
  } catch (error) {
    console.error('Error sending reminders:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}