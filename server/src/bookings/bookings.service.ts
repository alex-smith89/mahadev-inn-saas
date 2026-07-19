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

  private bookingNo(branch: Branch) {
    return `BKG-${Math.floor(10000 + Math.random() * 90000)}`;
  }

  private nights(ci: Date, co: Date) {
    return Math.max(0, Math.round((co.getTime() - ci.getTime()) / 86400000));
  }

  // ✅ Helper function to get room capacity
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

  // ✅ Helper function to get room type prefix
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

  // ✅ Create actual rooms for a branch if they don't exist
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

      const branchPrefix = branch.substring(0, 3).toUpperCase();
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
      // ✅ Validate branch
      if (!data.branch) {
        throw new BadRequestException('Branch is required');
      }

      this.logger.log(`📝 Creating booking for branch: ${data.branch}`);

      // Validate contact
      if (!/^\+\d{1,4}\d{10}$/.test(String(data.agentContact))) {
        throw new BadRequestException(
          'Agent Contact must be in format +CCXXXXXXXXXX (e.g., +977987654321)',
        );
      }

      const checkIn = new Date(data.checkIn);
      const checkOut = new Date(data.checkOut);
      const nights = this.nights(checkIn, checkOut);

      if (nights < 1) {
        throw new BadRequestException('Check-out must be after check-in');
      }

      const roomType = data.roomType;
      const roomsNeeded = Number(data.roomsCount) || 1;

      // ✅ Get branch capacity
      const branchCap = await this.prisma.branchCapacity.findUnique({
        where: { branch: data.branch as any },
      });

      let maxRooms = 0;
      if (branchCap) {
        switch(roomType) {
          case 'Single': maxRooms = branchCap.singleCap || 0; break;
          case 'Double': maxRooms = branchCap.doubleCap || 0; break;
          case 'Triple': maxRooms = branchCap.tripleCap || 0; break;
          case 'Quard': maxRooms = branchCap.quardCap || 0; break;
          case 'Suite': maxRooms = branchCap.suiteCap || 0; break;
          default: maxRooms = 0;
        }
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

      const roomCharges = data.roomCharges || data.price || 0;
      const totalPrice = roomCharges * data.roomsCount * nights;
      const bookingStatus = data.bookingStatus || 'Confirm';

      const roomCapacity = data.roomCapacity || this.getRoomCapacity(data.roomType);
      const totalCapacity = roomCapacity * (Number(data.roomsCount) || 1);

      const heads = Number(data.heads) || 1;
      const childrenBelow10 = Number(data.childrenBelow10) || 0;
      const adults = heads - childrenBelow10;
      const extraPersons = Math.max(0, adults - totalCapacity);

      // ✅ Create booking WITHOUT bookingRooms first
      const booking = await this.prisma.booking.create({
        data: {
          bookingNo: this.bookingNo(data.branch),
          agentName: data.agentName,
          agentContact: String(data.agentContact),
          email: data.email || null,
          roomsCount: Number(data.roomsCount) || 1,
          roomType: data.roomType as RoomTypeEnum,
          facility: data.facility || null,
          price: totalPrice,
          mealPlan: data.mealPlan as MealPlan,
          checkIn,
          checkOut,
          nights,
          remark: data.remark ?? null,
          branch: data.branch,
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
          createdBy: data.createdBy || 'Unknown',
          createdByRole: data.createdByRole || 'User',
          createdByUsername: data.createdBy || 'Unknown',
          creatorRole: data.createdByRole || 'User',
          userRole: data.createdByRole || 'User',
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

      this.logger.log(`✅ Booking created: ${booking.bookingNo}`);
      this.logger.log(`📊 Assigned rooms: ${selectedRooms.map(r => r.roomNumber).join(', ')}`);

      await this.createBookingNotification(booking);

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

      const keys = Object.keys(data);
      const isOnlyStatusUpdate = keys.length === 1 && keys[0] === 'bookingStatus';
      
      if (isOnlyStatusUpdate) {
        const updated = await this.prisma.booking.update({
          where: { id },
          data: {
            bookingStatus: data.bookingStatus,
          },
        });
        await this.createBookingNotification(updated);
        return updated;
      }

      // Full update logic...
      const checkIn = new Date(data.checkIn);
      const checkOut = new Date(data.checkOut);
      const nights = this.nights(checkIn, checkOut);

      if (nights < 1) {
        throw new BadRequestException('Check-out must be after check-in');
      }

      const roomCharges = data.roomCharges || data.price || 0;
      const totalPrice = roomCharges * data.roomsCount * nights;

      const roomCapacity = data.roomCapacity || this.getRoomCapacity(data.roomType);
      const totalCapacity = roomCapacity * (Number(data.roomsCount) || 1);

      const heads = Number(data.heads) || 1;
      const childrenBelow10 = Number(data.childrenBelow10) || 0;
      const adults = heads - childrenBelow10;
      const extraPersons = Math.max(0, adults - totalCapacity);

      const updated = await this.prisma.booking.update({
        where: { id },
        data: {
          agentName: data.agentName,
          agentContact: String(data.agentContact),
          roomsCount: Number(data.roomsCount) || 1,
          roomType: data.roomType as RoomTypeEnum,
          facility: data.facility || null,
          price: totalPrice,
          mealPlan: data.mealPlan as MealPlan,
          checkIn,
          checkOut,
          nights,
          remark: data.remark ?? null,
          branch: data.branch,
          bookingStatus: data.bookingStatus ?? 'Confirm',
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

      await this.prisma.bookingRoom.deleteMany({
        where: { bookingId: id },
      });

      await this.prisma.booking.delete({ where: { id } });
      this.logger.log(`🗑️ Booking deleted: ${booking.bookingNo}`);
      return { message: 'Booking deleted successfully' };
    } catch (error) {
      this.logger.error(`❌ Error removing booking: ${error.message}`);
      throw error;
    }
  }

  // ---------- LIST BOOKINGS ----------
  async list(branch: string, from?: string, to?: string) {
    const where: any = { branch: branch as Branch };

    if (from && to) {
      where.checkIn = { gte: new Date(from) };
      where.checkOut = { lte: new Date(to) };
    }

    return this.prisma.booking.findMany({
      where,
      orderBy: { checkIn: 'desc' },
    });
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