// src/bookings/bookings.service.ts
import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { Branch, Booking, BookingStatus, MealPlan, RoomTypeEnum } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    public prisma: PrismaService,
    private notificationService: NotificationService,
    private emailService: EmailService,
  ) {}

  private generateBookingNo(branch: Branch): string {
    const prefix = branch.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(100 + Math.random() * 900);
    return `${prefix}-${timestamp}${random}`;
  }

  private calculateNights(ci: Date, co: Date): number {
    return Math.max(0, Math.round((co.getTime() - ci.getTime()) / 86400000));
  }

  private getRoomCapacity(roomType: string): number {
    const capacityMap: Record<string, number> = {
      'Single': 1,
      'Double': 2,
      'Triple': 3,
      'Quard': 4,
      'Suite': 4,
    };
    return capacityMap[roomType] || 1;
  }

  private getRoomTypePrefix(roomType: string): string {
    const prefixes: {[key: string]: string} = {
      'Single': 'SGL',
      'Double': 'DBL',
      'Triple': 'TPL',
      'Quard': 'QRD',
      'Suite': 'STE'
    };
    return prefixes[roomType] || roomType.substring(0, 3).toUpperCase();
  }

  private getBranchPrefix(branch: string): string {
    const prefixes: {[key: string]: string} = {
      'Pokhara': 'POK',
      'Kathmandu': 'KTM',
      'Kathmandu1': 'KTM1',
      'Kathmandu2': 'KTM2',
      'Bhairawaha': 'BHA',
    };
    return prefixes[branch] || branch.substring(0, 3).toUpperCase();
  }

  // ✅ Ensure rooms exist for a branch
  private async ensureRoomsExist(branch: string, roomType: string, count: number) {
    try {
      const existingRooms = await this.prisma.room.findMany({
        where: {
          branch: branch as any,
          roomType: roomType as any,
        },
      });

      if (existingRooms.length >= count) {
        return existingRooms;
      }

      const branchPrefix = this.getBranchPrefix(branch);
      const typePrefix = this.getRoomTypePrefix(roomType);
      const capacity = this.getRoomCapacity(roomType);
      const createdRooms = [];

      const existingNumbers = existingRooms.map(r => {
        const parts = r.roomNumber.split('-');
        return parseInt(parts[2] || '0');
      });

      let nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

      for (let i = 0; i < count - existingRooms.length; i++) {
        const roomNumber = `${branchPrefix}-${typePrefix}-${String(nextNumber++).padStart(3, '0')}`;
        
        try {
          const room = await this.prisma.room.create({
            data: {
              roomNumber,
              branch: branch as any,
              roomType: roomType as any,
              capacity: capacity,
              status: 'available',
              floor: '1',
              description: `${roomType} room`,
            },
          });
          createdRooms.push(room);
          this.logger.log(`✅ Created room: ${roomNumber}`);
        } catch (error) {
          this.logger.error(`❌ Failed to create room ${roomNumber}: ${error.message}`);
        }
      }

      this.logger.log(`✅ Created ${createdRooms.length} ${roomType} rooms for ${branch}`);
      return [...existingRooms, ...createdRooms];
    } catch (error) {
      this.logger.error(`❌ Error ensuring rooms exist: ${error.message}`);
      return [];
    }
  }

  // ---------- CREATE BOOKING ----------
  async create(data: any): Promise<Booking> {
    try {
      // ✅ Validate required fields
      if (!data.branch) {
        throw new BadRequestException('Branch is required');
      }

      if (!data.agentName || !data.agentName.trim()) {
        throw new BadRequestException('Guest name is required');
      }

      if (!data.agentContact) {
        throw new BadRequestException('Contact number is required');
      }

      if (!data.email) {
        throw new BadRequestException('Email is required');
      }

      this.logger.log(`📝 Creating booking for branch: ${data.branch}`);

      // Validate contact format
      const contactStr = String(data.agentContact).replace(/\s/g, '');
      if (!/^\+\d{1,4}\d{10}$/.test(contactStr) && !/^\d{10}$/.test(contactStr)) {
        throw new BadRequestException(
          'Agent Contact must be 10 digits or in format +CCXXXXXXXXXX (e.g., +9779876543210)',
        );
      }

      // Validate email
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        throw new BadRequestException('Invalid email format');
      }

      const checkIn = new Date(data.checkIn);
      const checkOut = new Date(data.checkOut);
      
      if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
        throw new BadRequestException('Invalid check-in or check-out date');
      }

      const nights = this.calculateNights(checkIn, checkOut);

      if (nights < 1) {
        throw new BadRequestException('Check-out must be after check-in (minimum 1 night)');
      }

      const roomType = data.roomType;
      const roomsNeeded = Number(data.roomsCount) || 1;

      if (roomsNeeded < 1) {
        throw new BadRequestException('At least 1 room is required');
      }

      // ✅ Get branch capacity
      const branchCap = await this.prisma.branchCapacity.findUnique({
        where: { branch: data.branch as any },
      });

      if (!branchCap) {
        throw new BadRequestException(
          `No capacity configured for ${data.branch}. Please contact the owner to set up room capacity.`
        );
      }

      let maxRooms = 0;
      switch(roomType) {
        case 'Single': maxRooms = branchCap.singleCap || 0; break;
        case 'Double': maxRooms = branchCap.doubleCap || 0; break;
        case 'Triple': maxRooms = branchCap.tripleCap || 0; break;
        case 'Quard': maxRooms = branchCap.quardCap || 0; break;
        case 'Suite': maxRooms = branchCap.suiteCap || 0; break;
        default: maxRooms = 0;
      }

      if (maxRooms === 0) {
        throw new BadRequestException(
          `No ${roomType} rooms available in ${data.branch}. Please set capacity first.`
        );
      }

      // ✅ Ensure rooms exist
      await this.ensureRoomsExist(data.branch, roomType, maxRooms);

      // ✅ Check availability - get ALL rooms of this type
      const allRooms = await this.prisma.room.findMany({
        where: {
          branch: data.branch as any,
          roomType: roomType as any,
          status: 'available',
        },
        select: {
          id: true,
          roomNumber: true,
        },
      });

      // ✅ Get booked room IDs for the date range
      const bookedRoomIds = await this.prisma.bookingRoom.findMany({
        where: {
          room: {
            branch: data.branch as any,
            roomType: roomType as any,
          },
          booking: {
            OR: [
              {
                checkIn: { lt: checkOut },
                checkOut: { gt: checkIn },
              },
            ],
            bookingStatus: {
              notIn: ['Cancelled', 'CheckedOut'],
            },
          },
        },
        select: {
          roomId: true,
        },
      });

      const bookedIdSet = new Set(bookedRoomIds.map(br => br.roomId));
      const availableRooms = allRooms.filter(room => !bookedIdSet.has(room.id));

      this.logger.log(`📊 Available ${roomType} rooms: ${availableRooms.length} of ${maxRooms}`);

      if (availableRooms.length < roomsNeeded) {
        throw new BadRequestException(
          `Not enough ${roomType} rooms available in ${data.branch}. Only ${availableRooms.length} left.`
        );
      }

      // ✅ Select rooms
      const selectedRooms = availableRooms.slice(0, roomsNeeded);

      // ✅ Calculate pricing
      const roomCharges = Number(data.roomCharges) || Number(data.price) || 0;
      const totalPrice = roomCharges * roomsNeeded * nights;
      const bookingStatus = data.bookingStatus || 'Confirm';

      const roomCapacity = Number(data.roomCapacity) || this.getRoomCapacity(roomType);
      const totalCapacity = roomCapacity * roomsNeeded;

      const heads = Number(data.heads) || 1;
      const childrenBelow10 = Number(data.childrenBelow10) || 0;
      const adults = heads - childrenBelow10;
      const extraPersons = Math.max(0, adults - totalCapacity);

      // ✅ Handle optional fields - ensure they are either string or null
      const facilityValue = data.facility && data.facility.trim() ? data.facility.trim() : null;
      const remarkValue = data.remark && data.remark.trim() ? data.remark.trim() : null;

      // ✅ Generate booking number
      const bookingNo = data.bookingNo || this.generateBookingNo(data.branch);

      // ✅ Create booking
      const booking = await this.prisma.booking.create({
        data: {
          bookingNo: bookingNo,
          agentName: data.agentName.trim(),
          agentContact: contactStr,
          email: data.email.trim(),
          roomsCount: roomsNeeded,
          roomType: roomType as RoomTypeEnum,
          facility: facilityValue,
          facilityMultiplier: 1.0,
          price: totalPrice,
          mealPlan: (data.mealPlan as MealPlan) || MealPlan.EP,
          selfCooking: data.selfCooking || false,
          checkIn: checkIn,
          checkOut: checkOut,
          nights: nights,
          remark: remarkValue,
          branch: data.branch as Branch,
          bookingStatus: bookingStatus as BookingStatus,
          roomCharges: roomCharges,
          kitchenCharges: Number(data.kitchenCharges) || 0,
          diningCharges: Number(data.diningCharges) || 0,
          breakfastCharges: Number(data.breakfastCharges) || 0,
          currency: data.currency || 'NPR',
          heads: heads,
          extraPersonCharges: Number(data.extraPersonCharges) || 0,
          extraPersons: extraPersons,
          childrenCount: Number(data.childrenCount) || 0,
          childrenBelow10: childrenBelow10,
          totalCost: Number(data.totalCost) || totalPrice,
          roomCapacity: roomCapacity,
          totalCapacity: totalCapacity,
          createdBy: data.createdBy || data.createdByUsername || 'Unknown',
          createdByRole: data.createdByRole || data.creatorRole || 'User',
          userRole: data.userRole || data.createdByRole || 'User',
          createdByUsername: data.createdBy || data.createdByUsername || 'Unknown',
          creatorRole: data.creatorRole || data.createdByRole || 'User',
          branchName: data.branch,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // ✅ Create booking room associations
      for (const room of selectedRooms) {
        await this.prisma.bookingRoom.create({
          data: {
            bookingId: booking.id,
            roomId: room.id,
            assignedAt: new Date(),
          },
        });
      }

      // ✅ Update room availability
      for (const room of selectedRooms) {
        // Mark rooms as unavailable for the booking period
        let currentDate = new Date(checkIn);
        while (currentDate < checkOut) {
          await this.prisma.roomAvailability.upsert({
            where: {
              roomId_date: {
                roomId: room.id,
                date: new Date(currentDate),
              },
            },
            update: {
              isAvailable: false,
              bookingId: booking.id,
            },
            create: {
              roomId: room.id,
              date: new Date(currentDate),
              isAvailable: false,
              bookingId: booking.id,
            },
          });
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

      this.logger.log(`✅ Booking created: ${booking.bookingNo}`);
      this.logger.log(`📊 Assigned rooms: ${selectedRooms.map(r => r.roomNumber).join(', ')}`);

      // ✅ Create notification
      await this.createBookingNotification(booking);

      // ✅ Send email confirmation
      if (booking.email) {
        try {
          await this.emailService.sendBookingConfirmation(booking.email, booking);
        } catch (emailError) {
          this.logger.error(`❌ Email failed: ${emailError.message}`);
          // Don't fail the booking if email fails
        }
      }

      return booking;
    } catch (error) {
      this.logger.error(`❌ Error creating booking: ${error.message}`);
      this.logger.error(`❌ Stack: ${error.stack}`);
      throw error;
    }
  }

  // ---------- CREATE NOTIFICATION ----------
  private async createBookingNotification(booking: any) {
    try {
      let title: string;
      let message: string;
      let type: string;

      switch (booking.bookingStatus) {
        case 'CheckedIn':
          title = '✅ Guest Checked In';
          message = `${booking.agentName} (${booking.bookingNo}) has checked in at ${booking.branch}.`;
          type = 'checkin_success';
          break;
        case 'CheckedOut':
          title = '📤 Guest Checked Out';
          message = `${booking.agentName} (${booking.bookingNo}) has checked out from ${booking.branch}.`;
          type = 'checkout_success';
          break;
        case 'New':
          title = '📋 New Booking Created';
          message = `${booking.agentName} (${booking.bookingNo}) has made a new booking at ${booking.branch}.`;
          type = 'booking_created';
          break;
        case 'Confirm':
        case 'Confirmed':
          title = '✅ Booking Confirmed';
          message = `${booking.agentName} (${booking.bookingNo}) has confirmed booking at ${booking.branch}.`;
          type = 'booking_confirmed';
          break;
        default:
          title = '📋 Booking Update';
          message = `${booking.agentName} (${booking.bookingNo}) has a booking at ${booking.branch}.`;
          type = 'booking_update';
      }

      await this.prisma.notification.create({
        data: {
          title,
          message,
          branch: booking.branch,
          bookingId: booking.id,
          type,
          isRead: false,
          createdAt: new Date(),
        },
      });

      this.logger.log(`✅ Notification created for ${booking.bookingNo}`);
    } catch (error) {
      this.logger.error(`❌ Failed to create notification: ${error.message}`);
    }
  }

  // ---------- UPDATE BOOKING ----------
  async update(id: string, data: any): Promise<Booking> {
    try {
      const existing = await this.prisma.booking.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException('Booking not found');
      }

      // Handle status-only update
      const keys = Object.keys(data);
      const isOnlyStatusUpdate = keys.length === 1 && keys[0] === 'bookingStatus';
      
      if (isOnlyStatusUpdate) {
        const updated = await this.prisma.booking.update({
          where: { id },
          data: {
            bookingStatus: data.bookingStatus,
            updatedAt: new Date(),
          },
        });
        await this.createBookingNotification(updated);
        return updated;
      }

      // Full update
      const checkIn = new Date(data.checkIn);
      const checkOut = new Date(data.checkOut);
      const nights = this.calculateNights(checkIn, checkOut);

      if (nights < 1) {
        throw new BadRequestException('Check-out must be after check-in');
      }

      const roomCharges = Number(data.roomCharges) || Number(data.price) || 0;
      const totalPrice = roomCharges * Number(data.roomsCount) * nights;

      const roomCapacity = Number(data.roomCapacity) || this.getRoomCapacity(data.roomType);
      const totalCapacity = roomCapacity * (Number(data.roomsCount) || 1);

      const heads = Number(data.heads) || 1;
      const childrenBelow10 = Number(data.childrenBelow10) || 0;
      const adults = heads - childrenBelow10;
      const extraPersons = Math.max(0, adults - totalCapacity);

      const facilityValue = data.facility && data.facility.trim() ? data.facility.trim() : null;
      const remarkValue = data.remark && data.remark.trim() ? data.remark.trim() : null;

      const updated = await this.prisma.booking.update({
        where: { id },
        data: {
          agentName: data.agentName,
          agentContact: String(data.agentContact),
          email: data.email || null,
          roomsCount: Number(data.roomsCount) || 1,
          roomType: data.roomType as RoomTypeEnum,
          facility: facilityValue,
          price: totalPrice,
          mealPlan: data.mealPlan as MealPlan,
          checkIn,
          checkOut,
          nights,
          remark: remarkValue,
          branch: data.branch,
          bookingStatus: data.bookingStatus || 'Confirm',
          roomCharges: roomCharges,
          kitchenCharges: Number(data.kitchenCharges) || 0,
          diningCharges: Number(data.diningCharges) || 0,
          breakfastCharges: Number(data.breakfastCharges) || 0,
          currency: data.currency || 'NPR',
          heads: heads,
          extraPersonCharges: Number(data.extraPersonCharges) || 0,
          extraPersons: extraPersons,
          childrenCount: Number(data.childrenCount) || 0,
          childrenBelow10: childrenBelow10,
          totalCost: Number(data.totalCost) || totalPrice,
          roomCapacity: roomCapacity,
          totalCapacity: totalCapacity,
          updatedAt: new Date(),
        },
      });

      await this.createBookingNotification(updated);
      return updated;
    } catch (error) {
      this.logger.error(`❌ Error updating booking: ${error.message}`);
      throw error;
    }
  }

  // ---------- CHECK-IN GUEST ----------
  async checkInGuest(id: string): Promise<Booking> {
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.bookingStatus === 'CheckedIn') {
        throw new BadRequestException('Guest is already checked in');
      }

      if (booking.bookingStatus === 'CheckedOut') {
        throw new BadRequestException('Guest has already checked out');
      }

      if (booking.bookingStatus === 'Cancelled') {
        throw new BadRequestException('Cannot check in a cancelled booking');
      }

      const updated = await this.prisma.booking.update({
        where: { id },
        data: {
          bookingStatus: 'CheckedIn',
          actualCheckIn: new Date(),
          updatedAt: new Date(),
        },
      });

      await this.notificationService.createCheckinNotification(updated);
      this.logger.log(`✅ Guest checked in: ${updated.bookingNo}`);

      if (updated.email) {
        try {
          await this.emailService.sendCheckInConfirmation(updated.email, updated);
        } catch (emailError) {
          this.logger.error(`❌ Email failed: ${emailError.message}`);
        }
      }

      return updated;
    } catch (error) {
      this.logger.error(`❌ Error checking in guest: ${error.message}`);
      throw error;
    }
  }

  // ---------- CHECK-OUT GUEST ----------
  async checkOutGuest(id: string): Promise<Booking> {
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.bookingStatus === 'CheckedOut') {
        throw new BadRequestException('Guest has already checked out');
      }

      if (booking.bookingStatus === 'Cancelled') {
        throw new BadRequestException('Cannot check out a cancelled booking');
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkOutDate = new Date(booking.checkOut);
      checkOutDate.setHours(0, 0, 0, 0);

      if (checkOutDate > today) {
        const dateStr = checkOutDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        throw new BadRequestException(
          `Cannot check out guest yet. Check-out date is ${dateStr}. Please wait until the check-out date.`
        );
      }

      const updated = await this.prisma.booking.update({
        where: { id },
        data: {
          bookingStatus: 'CheckedOut',
          actualCheckOut: new Date(),
          updatedAt: new Date(),
        },
      });

      // Update room availability to available
      const bookingRooms = await this.prisma.bookingRoom.findMany({
        where: { bookingId: id },
        select: { roomId: true },
      });

      for (const br of bookingRooms) {
        let currentDate = new Date(booking.checkIn);
        while (currentDate < new Date(booking.checkOut)) {
          await this.prisma.roomAvailability.updateMany({
            where: {
              roomId: br.roomId,
              date: new Date(currentDate),
            },
            data: {
              isAvailable: true,
              bookingId: null,
            },
          });
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

      await this.notificationService.createCheckoutNotification(updated);
      this.logger.log(`✅ Guest checked out: ${updated.bookingNo}`);

      if (updated.email) {
        try {
          await this.emailService.sendCheckOutConfirmation(updated.email, updated);
        } catch (emailError) {
          this.logger.error(`❌ Email failed: ${emailError.message}`);
        }
      }

      return updated;
    } catch (error) {
      this.logger.error(`❌ Error checking out guest: ${error.message}`);
      throw error;
    }
  }

  // ---------- REMOVE BOOKING ----------
  async remove(id: string) {
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      // Delete booking rooms
      await this.prisma.bookingRoom.deleteMany({
        where: { bookingId: id },
      });

      // Delete room availability entries
      await this.prisma.roomAvailability.deleteMany({
        where: { bookingId: id },
      });

      // Delete the booking
      await this.prisma.booking.delete({ where: { id } });
      this.logger.log(`🗑️ Booking deleted: ${booking.bookingNo}`);
      return { message: 'Booking deleted successfully' };
    } catch (error) {
      this.logger.error(`❌ Error removing booking: ${error.message}`);
      throw error;
    }
  }

  // ---------- LIST BOOKINGS ----------
  async list(branch?: string, from?: string, to?: string) {
    try {
      const where: any = {};

      if (branch && branch !== 'all') {
        where.branch = branch as Branch;
      }

      if (from && to) {
        where.checkIn = { gte: new Date(from) };
        where.checkOut = { lte: new Date(to) };
      }

      const bookings = await this.prisma.booking.findMany({
        where,
        orderBy: { checkIn: 'desc' },
      });

      return bookings;
    } catch (error) {
      this.logger.error(`❌ Error listing bookings: ${error.message}`);
      throw error;
    }
  }

  // ---------- FIND ONE ----------
  async findOne(id: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  // ---------- FIND BY BOOKING NO ----------
  async findByBookingNo(bookingNo: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { bookingNo },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${bookingNo} not found`);
    }

    return booking;
  }

  // ---------- GET BOOKING STATS ----------
  async getBookingStats(branch: string, user?: any) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let where: any = {};
      
      if (user && user.role === 'VIEWER') {
        const userBranches = user.branches || [];
        if (userBranches.length === 0) {
          return {
            confirmed: 0,
            pending: 0,
            todayCheckIns: 0,
            tomorrowCheckOuts: 0,
            totalRevenue: 0,
            totalCustomers: 0,
            totalBookings: 0,
            branch: branch || 'none',
          };
        }
        if (branch && branch !== 'all' && userBranches.includes(branch)) {
          where.branch = branch as Branch;
        } else {
          where.branch = { in: userBranches };
        }
      } else if (branch && branch !== 'all') {
        where.branch = branch as Branch;
      }
      
      const allBookings = await this.prisma.booking.findMany({
        where,
      });

      const confirmedBookings = allBookings.filter(
        b => b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed'
      );

      const pendingBookings = allBookings.filter(
        b => b.bookingStatus === 'Pending'
      );

      const todayCheckIns = allBookings.filter(
        b => (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed') && 
        new Date(b.checkIn).toDateString() === today.toDateString()
      );

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowCheckOuts = allBookings.filter(
        b => (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed') &&
        new Date(b.checkOut).toDateString() === tomorrow.toDateString()
      );

      let totalRevenue = 0;
      confirmedBookings.forEach(b => {
        totalRevenue += (b.price || b.roomCharges || 0);
      });

      const uniqueCustomers = new Set();
      allBookings.forEach(b => {
        if (b.agentName) uniqueCustomers.add(b.agentName);
      });

      return {
        confirmed: confirmedBookings.length,
        pending: pendingBookings.length,
        todayCheckIns: todayCheckIns.length,
        tomorrowCheckOuts: tomorrowCheckOuts.length,
        totalRevenue: totalRevenue,
        totalCustomers: uniqueCustomers.size,
        totalBookings: allBookings.length,
        branch: branch || 'all',
      };
    } catch (error) {
      this.logger.error('Error in getBookingStats:', error);
      return {
        confirmed: 0,
        pending: 0,
        todayCheckIns: 0,
        tomorrowCheckOuts: 0,
        totalRevenue: 0,
        totalCustomers: 0,
        totalBookings: 0,
        branch: branch || 'all',
      };
    }
  }

  // ---------- GET DASHBOARD STATS ----------
  async getDashboardStats(branch: string, user?: any) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let where: any = {};
      
      if (user && user.role === 'VIEWER') {
        const userBranches = user.branches || [];
        if (userBranches.length === 0) {
          return {
            success: true,
            branch: branch || 'none',
            date: today.toISOString().slice(0, 10),
            stats: {
              totalRooms: 0,
              occupiedRooms: 0,
              availableRooms: 0,
              occupancyPercent: 0,
              totalBookings: 0,
              totalRevenue: 0,
              totalCustomers: 0,
              todayCheckIns: 0,
              todayCheckOuts: 0,
              activeBookings: 0,
            },
            changes: { customers: 0, bookings: 0, rooms: 0, revenue: 0 },
            allBookings: [],
          };
        }
        if (branch && branch !== 'all' && userBranches.includes(branch)) {
          where.branch = branch as Branch;
        } else {
          where.branch = { in: userBranches };
        }
      } else if (branch && branch !== 'all') {
        where.branch = branch as Branch;
      }
      
      const allBookings = await this.prisma.booking.findMany({
        where,
      });

      const confirmedBookings = allBookings.filter(
        b => b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed'
      );

      const totalBookings = allBookings.length;

      let totalRooms = 50;
      if (branch && branch !== 'all') {
        const capacity = await this.prisma.branchCapacity.findUnique({
          where: { branch: branch as Branch },
        });
        totalRooms = capacity ? 
          (capacity.singleCap || 0) + 
          (capacity.doubleCap || 0) + 
          (capacity.tripleCap || 0) + 
          (capacity.quardCap || 0) + 
          (capacity.suiteCap || 0)
          : 50;
      } else {
        const allCapacities = await this.prisma.branchCapacity.findMany();
        totalRooms = allCapacities.reduce((sum, cap) => 
          sum + (cap.singleCap || 0) + (cap.doubleCap || 0) + (cap.tripleCap || 0) + (cap.quardCap || 0) + (cap.suiteCap || 0), 0
        ) || 50;
      }
      
      const todayBookings = allBookings.filter(
        b => (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed' || b.bookingStatus === 'CheckedIn') &&
        new Date(b.checkIn) <= today && 
        new Date(b.checkOut) > today
      );

      const occupiedRooms = todayBookings.reduce((sum, b) => sum + b.roomsCount, 0);
      const availableRooms = Math.max(0, totalRooms - occupiedRooms);
      const occupancyPercent = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

      let totalRevenue = 0;
      confirmedBookings.forEach(b => {
        const price = b.price || b.roomCharges || 0;
        totalRevenue += price;
      });

      const uniqueCustomers = new Set();
      allBookings.forEach(b => {
        if (b.agentName) uniqueCustomers.add(b.agentName);
      });

      const todayCheckInsCount = allBookings.filter(
        b => new Date(b.checkIn).toDateString() === today.toDateString() &&
        (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed')
      ).length;

      const todayCheckOutsCount = allBookings.filter(
        b => new Date(b.checkOut).toDateString() === today.toDateString() &&
        (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed' || b.bookingStatus === 'CheckedIn')
      ).length;

      const activeBookings = allBookings.filter(
        b => (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed' || b.bookingStatus === 'CheckedIn') &&
        new Date(b.checkIn) <= today && 
        new Date(b.checkOut) > today
      ).length;

      return {
        success: true,
        branch: branch || 'all',
        date: today.toISOString().slice(0, 10),
        stats: {
          totalRooms,
          occupiedRooms,
          availableRooms,
          occupancyPercent,
          totalBookings,
          totalRevenue: totalRevenue,
          totalCustomers: uniqueCustomers.size,
          todayCheckIns: todayCheckInsCount,
          todayCheckOuts: todayCheckOutsCount,
          activeBookings: activeBookings,
        },
        changes: {
          customers: 0,
          bookings: 0,
          rooms: 0,
          revenue: 0,
        },
        allBookings: allBookings,
      };
    } catch (error) {
      this.logger.error('Error in getDashboardStats:', error);
      return {
        success: true,
        branch: branch || 'all',
        date: new Date().toISOString().slice(0, 10),
        stats: {
          totalRooms: 50,
          occupiedRooms: 0,
          availableRooms: 50,
          occupancyPercent: 0,
          totalBookings: 0,
          totalRevenue: 0,
          totalCustomers: 0,
          todayCheckIns: 0,
          todayCheckOuts: 0,
          activeBookings: 0,
        },
        changes: { customers: 0, bookings: 0, rooms: 0, revenue: 0 },
        allBookings: [],
      };
    }
  }

  // ---------- CHECK ROOM AVAILABILITY ----------
  async checkRoomAvailability(
    branch: string,
    roomType: string,
    checkIn: Date,
    checkOut: Date,
    roomsNeeded: number
  ) {
    try {
      this.logger.log(`📊 Checking availability for ${roomType} in ${branch}`);

      const allRooms = await this.prisma.room.findMany({
        where: {
          branch: branch as any,
          roomType: roomType as any,
          status: 'available',
        },
        select: {
          id: true,
          roomNumber: true,
        },
      });

      const bookedRooms = await this.prisma.bookingRoom.findMany({
        where: {
          room: {
            branch: branch as any,
            roomType: roomType as any,
          },
          booking: {
            OR: [
              {
                checkIn: { lt: checkOut },
                checkOut: { gt: checkIn },
              },
            ],
            bookingStatus: {
              notIn: ['Cancelled', 'CheckedOut'],
            },
          },
        },
        select: {
          roomId: true,
        },
      });

      const bookedRoomIds = new Set(bookedRooms.map(br => br.roomId));
      const availableRooms = allRooms.filter(room => !bookedRoomIds.has(room.id));

      return {
        available: availableRooms.length,
        total: allRooms.length,
        booked: bookedRoomIds.size,
        isAvailable: availableRooms.length >= roomsNeeded,
        availableRoomNumbers: availableRooms.map(r => r.roomNumber),
      };
    } catch (error) {
      this.logger.error(`❌ Error checking availability: ${error.message}`);
      throw error;
    }
  }
}