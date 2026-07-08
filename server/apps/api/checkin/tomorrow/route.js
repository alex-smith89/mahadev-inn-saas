// src/app/api/checkin/tomorrow/route.js
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request) {
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
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const checkins = await prisma.booking.findMany({
      where: {
        branch: {
          in: userBranches,
        },
        checkIn: {
          gte: tomorrow,
          lt: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000),
        },
        bookingStatus: {
          in: ['Confirm', 'Confirmed', 'Pending'],
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: checkins,
    });
  } catch (error) {
    console.error('Error fetching tomorrow checkins:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch tomorrow checkins' },
      { status: 500 }
    );
  }
}