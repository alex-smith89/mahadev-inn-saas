// src/app/api/automation/checkout/route.js
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request) {
  console.log('🔄 Auto checkout API called');
  
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

    return NextResponse.json({
      success: true,
      data: { checkedOut },
    });
  } catch (error) {
    console.error('Error in checkout automation:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}