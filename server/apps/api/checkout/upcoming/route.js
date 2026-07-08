// src/app/api/checkout/upcoming/route.js
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const upcoming = await prisma.booking.findMany({
      where: {
        branch: {
          in: userBranches,
        },
        checkOut: {
          gte: today,
        },
        bookingStatus: {
          in: ['Confirm', 'Confirmed', 'CheckedIn'],
        },
      },
      orderBy: {
        checkOut: 'asc',
      },
    });

    return NextResponse.json({
      success: true,
      data: upcoming,
    });
  } catch (error) {
    console.error('Error fetching upcoming checkouts:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch upcoming checkouts' },
      { status: 500 }
    );
  }
}