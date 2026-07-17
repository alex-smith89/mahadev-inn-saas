// server/src/app/api/bookings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Branch, RoomTypeEnum, BookingStatus } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('📋 Creating booking with payload:', body);

    const {
      bookingNo,
      agentName,
      agentContact,
      email,
      branch,
      roomType,
      facility,
      facilityMultiplier,
      roomsCount,
      heads,
      childrenBelow10,
      mealPlan,
      checkIn,
      checkOut,
      bookingStatus,
      roomCharges,
      extraPersonCharges,
      extraPersons,
      kitchenCharges,
      diningCharges,
      breakfastCharges,
      currency,
      subtotal,
      vatAmount,
      vatRate,
      totalCost,
      totalCostNPR,
      totalCostINR,
      remark,
      bookedAt,
      roomCapacity,
      totalCapacity,
      createdBy,
      createdByRole,
    } = body;

    // Validate required fields
    if (!branch || !roomType || !roomsCount || !checkIn || !checkOut) {
      return NextResponse.json(
        { error: 'Missing required fields: branch, roomType, roomsCount, checkIn, checkOut' },
        { status: 400 }
      );
    }

    // Validate facility
    if (!facility) {
      return NextResponse.json(
        { error: 'Facility is required' },
        { status: 400 }
      );
    }

    const branchEnum = branch as Branch;
    const roomTypeEnum = roomType as RoomTypeEnum;
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    // Check room availability
    const availableRooms = await prisma.room.findMany({
      where: {
        branch: branchEnum,
        roomType: roomTypeEnum,
        status: 'available',
        bookings: {
          none: {
            booking: {
              OR: [
                {
                  checkIn: { lt: checkOutDate },
                  checkOut: { gt: checkInDate },
                },
              ],
              bookingStatus: {
                notIn: ['Cancelled', 'CheckedOut'],
              },
            },
          },
        },
      },
    });

    console.log(`📊 Available ${roomType} rooms for booking: ${availableRooms.length}`);

    if (availableRooms.length < roomsCount) {
      return NextResponse.json(
        { 
          error: `Not enough ${roomType} rooms available in ${branch}. Only ${availableRooms.length} left.`,
          availableRooms: availableRooms.length,
          requestedRooms: roomsCount,
        },
        { status: 400 }
      );
    }

    // Select the rooms for this booking
    const selectedRooms = availableRooms.slice(0, roomsCount);

    // Calculate nights
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

    // Create the booking
    const booking = await prisma.booking.create({
      data: {
        bookingNo,
        agentName,
        agentContact,
        email: email || null,
        branch: branchEnum,
        roomType: roomTypeEnum,
        facility: facility || 'Standard',
        facilityMultiplier: facilityMultiplier || 1.0,
        roomsCount,
        heads: heads || 1,
        childrenBelow10: childrenBelow10 || 0,
        mealPlan: mealPlan || 'EP',
        checkIn: checkInDate,
        checkOut: checkOutDate,
        nights: nights || 1,
        bookingStatus: bookingStatus || BookingStatus.Confirm,
        roomCharges: roomCharges || 0,
        extraPersonCharges: extraPersonCharges || 0,
        extraPersons: extraPersons || 0,
        kitchenCharges: kitchenCharges || 0,
        diningCharges: diningCharges || 0,
        breakfastCharges: breakfastCharges || 0,
        currency: currency || 'NPR',
        subtotal: subtotal || 0,
        vatAmount: vatAmount || 0,
        vatRate: vatRate || 13,
        totalCost: totalCost || 0,
        totalCostNPR: totalCostNPR || 0,
        totalCostINR: totalCostINR || 0,
        remark: remark || null,
        bookedAt: new Date(bookedAt || new Date()),
        roomCapacity: roomCapacity || 1,
        totalCapacity: totalCapacity || 1,
        createdBy: createdBy || 'system',
        createdByRole: createdByRole || 'USER',
        // Room relations
        bookingRooms: {
          create: selectedRooms.map(room => ({
            roomId: room.id,
            assignedAt: new Date(),
          })),
        },
      },
    });

    console.log(`✅ Booking created successfully: ${booking.bookingNo}`);

    return NextResponse.json({
      data: booking,
      notifiedUsers: 0,
      message: 'Booking created successfully',
      roomsAssigned: selectedRooms.map(r => r.roomNumber),
    });
  } catch (error) {
    console.error('❌ Error creating booking:', error);
    return NextResponse.json(
      { error: 'Failed to create booking: ' + (error as Error).message },
      { status: 500 }
    );
  }
}