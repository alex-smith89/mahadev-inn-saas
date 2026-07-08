// src/app/api/bookings/route.js (POST handler)
export async function POST(request) {
  try {
    // ... existing validation and creation code ...
    
    const booking = await prisma.booking.create({
      data: {
        // ... all booking data ...
      },
    });

    // Send confirmation email
    if (booking.email) {
      try {
        await emailService.sendBookingConfirmation(booking, booking.email);
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
        // Still return success but log the error
      }
    }

    // Create notification for staff
    await prisma.notification.create({
      data: {
        title: 'New Booking Created',
        message: `New booking #${booking.bookingNo} created for ${booking.agentName}`,
        branch: booking.branch,
        bookingId: booking.id,
        type: 'booking_created',
      },
    });

    return NextResponse.json({
      success: true,
      data: booking,
      message: 'Booking created successfully',
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create booking' },
      { status: 500 }
    );
  }
}