// src/app/api/automation/checkin/route.js
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request) {
  console.log('🔄 Auto check-in API called');
  
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

    for (const booking of bookingsToCheckin) {
      try {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { bookingStatus: 'CheckedIn' },
        });
        
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

    return NextResponse.json({
      success: true,
      data: { checkedIn },
    });
  } catch (error) {
    console.error('Error in check-in automation:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}