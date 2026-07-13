// src/bookings/bookings.service.ts
import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { Branch, Booking, BookingStatus, MealPlan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RoomTypeEnum } from '@prisma/client';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(public prisma: PrismaService) {}

  private bookingNo(branch: Branch) {
    return `BKG-${Math.floor(10000 + Math.random() * 90000)}`;
  }

  private nights(ci: Date, co: Date) {
    return Math.max(0, Math.round((co.getTime() - ci.getTime()) / 86400000));
  }

  // ---------- GENERATE BOOKING NUMBER ----------
  private async generateBookingNumber(): Promise<string> {
    const count = await this.prisma.booking.count();
    const year = new Date().getFullYear().toString().slice(-2);
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const seq = String(count + 1).padStart(4, '0');
    return `BKG-${year}${month}-${seq}`;
  }

  // ---------- CREATE BOOKING ----------
  async create(data: any): Promise<Booking> {
    // ✅ Validate branch is provided
    if (!data.branch) {
      this.logger.error('❌ Branch is required but not provided');
      throw new BadRequestException('Branch is required');
    }

    this.logger.log(`📝 Creating booking for branch: ${data.branch}`);
    this.logger.log(`📋 Booking data:`, {
      agentName: data.agentName,
      roomType: data.roomType,
      roomsCount: data.roomsCount,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
    });

    // Validate contact format
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

    // ✅ Check branch capacity
    try {
      const capacity = await this.prisma.branchCapacity.findUnique({
        where: { branch: data.branch },
      });

      if (!capacity) {
        this.logger.warn(`⚠️ No capacity record found for branch: ${data.branch}, skipping capacity check`);
      } else {
        // Check overlapping bookings
        const overlapping = await this.prisma.booking.findMany({
          where: {
            branch: data.branch,
            roomType: data.roomType,
            bookingStatus: { in: ['Confirm', 'Confirmed'] },
            OR: [
              {
                checkIn: { lte: checkOut },
                checkOut: { gte: checkIn },
              },
            ],
          },
        });

        const totalBooked = overlapping.reduce((sum: any, b: { roomsCount: any }) => sum + b.roomsCount, 0);
        const maxCap =
          data.roomType === 'Single'
            ? capacity.singleCap
            : data.roomType === 'Double'
            ? capacity.doubleCap
            : data.roomType === 'Triple'
            ? capacity.tripleCap
            : data.roomType === 'Quard'
            ? capacity.quardCap
            : 0;

        if (totalBooked + data.roomsCount > maxCap) {
          const available = maxCap - totalBooked;
          throw new BadRequestException(
            `Not enough ${data.roomType} rooms available in ${data.branch}. Only ${
              available >= 0 ? available : 0
            } left.`,
          );
        }
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.warn(`⚠️ Capacity check failed: ${error.message}, continuing anyway`);
    }

    const roomCharges = data.roomCharges || data.price || 0;
    const totalPrice = roomCharges * data.roomsCount * nights;

    // ✅ Create booking with only fields that exist in schema
    const booking = await this.prisma.booking.create({
      data: {
        bookingNo: this.bookingNo(data.branch),
        agentName: data.agentName,
        agentContact: String(data.agentContact),
        email: data.email || null,
        roomsCount: Number(data.roomsCount),
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
        kitchenCharges: data.kitchenCharges || 0,
        diningCharges: data.diningCharges || 0,
        currency: data.currency || 'NPR',
        heads: data.heads || 1,
        extraPersonCharges: data.extraPersonCharges || 0,
        childrenCount: data.childrenCount || 0,
        childrenBelow10: data.childrenBelow10 || 0,
      },
    });

    this.logger.log(`✅ Booking created with ID: ${booking.id} for branch: ${booking.branch}`);
    return booking;
  }

  // ---------- UPDATE BOOKING ----------
  async update(id: string, data: any): Promise<Booking> {
    try {
      this.logger.log('📝 Updating booking:', id, data);

      const existing = await this.prisma.booking.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new BadRequestException('Booking not found');
      }

      // ✅ If only status update, skip all validation
      const keys = Object.keys(data);
      const isOnlyStatusUpdate = keys.length === 1 && keys[0] === 'bookingStatus';
      
      if (isOnlyStatusUpdate) {
        this.logger.log(`✅ Updating only status to: ${data.bookingStatus}`);
        const updated = await this.prisma.booking.update({
          where: { id },
          data: {
            bookingStatus: data.bookingStatus,
          },
        });
        return updated;
      }

      // ✅ For full updates, validate all fields
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

      // ✅ Check branch capacity
      try {
        const capacity = await this.prisma.branchCapacity.findUnique({
          where: { branch: data.branch },
        });

        if (!capacity) {
          this.logger.warn(`⚠️ No capacity record found for branch: ${data.branch}, skipping capacity check`);
        } else {
          const overlapping = await this.prisma.booking.findMany({
            where: {
              branch: data.branch,
              roomType: data.roomType,
              bookingStatus: { in: ['Confirm', 'Confirmed'] },
              NOT: { id },
              OR: [
                {
                  checkIn: { lte: checkOut },
                  checkOut: { gte: checkIn },
                },
              ],
            },
          });

          const totalBooked = overlapping.reduce((sum: any, b: { roomsCount: any }) => sum + b.roomsCount, 0);
          const maxCap =
            data.roomType === 'Single'
              ? capacity.singleCap
              : data.roomType === 'Double'
              ? capacity.doubleCap
              : data.roomType === 'Triple'
              ? capacity.tripleCap
              : data.roomType === 'Quard'
              ? capacity.quardCap
              : 0;

          if (totalBooked + data.roomsCount > maxCap) {
            const available = maxCap - totalBooked;
            throw new BadRequestException(
              `Not enough ${data.roomType} rooms available in ${data.branch}. Only ${
                available >= 0 ? available : 0
              } left.`,
            );
          }
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        this.logger.warn(`⚠️ Capacity check failed: ${error.message}, continuing anyway`);
      }

      const roomCharges = data.roomCharges || data.price || 0;
      const totalPrice = roomCharges * data.roomsCount * nights;

      const updated = await this.prisma.booking.update({
        where: { id },
        data: {
          agentName: data.agentName,
          agentContact: String(data.agentContact),
          roomsCount: Number(data.roomsCount),
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
          kitchenCharges: data.kitchenCharges || 0,
          diningCharges: data.diningCharges || 0,
          currency: data.currency || 'NPR',
          heads: data.heads || 1,
          extraPersonCharges: data.extraPersonCharges || 0,
          childrenCount: data.childrenCount || 0,
          childrenBelow10: data.childrenBelow10 || 0,
        },
      });

      return updated;
    } catch (error) {
      this.logger.error('❌ Error updating booking:', error);
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

    const bookings = await this.prisma.booking.findMany({
      where,
      orderBy: { checkIn: 'desc' },
    });

    return bookings;
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

  // ---------- REMOVE BOOKING ----------
  async remove(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    await this.prisma.booking.delete({ where: { id } });
    return { message: 'Booking deleted successfully' };
  }

  // ============================================================
  // ✅ GET BOOKING STATS - With viewer branch filtering
  // ============================================================
  async getBookingStats(branch: string, user?: any) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let where: any = {};
      
      // ✅ If user is VIEWER, restrict to their branches
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
      throw error;
    }
  }

  // ============================================================
  // ✅ GET DASHBOARD STATS - With viewer branch filtering
  // ============================================================
  async getDashboardStats(branch: string, user?: any) {
    try {
      this.logger.log(`📊 Fetching dashboard stats for branch: ${branch}`);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let where: any = {};
      
      // ✅ If user is VIEWER, restrict to their branches
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
          (capacity.quardCap || 0) 
          : 50;
      } else {
        const allCapacities = await this.prisma.branchCapacity.findMany();
        totalRooms = allCapacities.reduce((sum, cap) => 
          sum + (cap.singleCap || 0) + (cap.doubleCap || 0) + (cap.tripleCap || 0) + (cap.quardCap || 0), 0
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
      throw error;
    }
  }

  // ============================================================
  // ✅ GET BOOKINGS FOR BRANCH (with pagination)
  // ============================================================
  async getBookingsForBranch(
    branch: string,
    page: number = 1,
    limit: number = 50,
    status?: string,
    from?: string,
    to?: string,
    user?: any,
  ) {
    let where: any = {};
    
    // ✅ If user is VIEWER, restrict to their branches
    if (user && user.role === 'VIEWER') {
      const userBranches = user.branches || [];
      if (userBranches.length === 0) {
        return { bookings: [], total: 0, page, limit, totalPages: 0 };
      }
      if (branch && branch !== 'all' && userBranches.includes(branch)) {
        where.branch = branch as Branch;
      } else {
        where.branch = { in: userBranches };
      }
    } else if (branch && branch !== 'all') {
      where.branch = branch as Branch;
    }

    if (status) {
      where.bookingStatus = status;
    }

    if (from && to) {
      where.checkIn = { gte: new Date(from) };
      where.checkOut = { lte: new Date(to) };
    }

    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: { checkIn: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      bookings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ---------- GET BOOKINGS BY BRANCH ----------
  async getBookingsByBranch(branch: Branch) {
    return this.prisma.booking.findMany({
      where: { branch },
      orderBy: { checkIn: 'desc' },
    });
  }

  // ---------- GET BOOKINGS BY DATE RANGE ----------
  async getBookingsByDateRange(from: Date, to: Date, branch?: Branch) {
    const where: any = {
      OR: [
        {
          checkIn: { gte: from, lte: to },
        },
        {
          checkOut: { gte: from, lte: to },
        },
      ],
    };

    if (branch) {
      where.branch = branch;
    }

    return this.prisma.booking.findMany({
      where,
      orderBy: { checkIn: 'asc' },
    });
  }

  // ---------- GET OCCUPANCY FOR DATE ----------
  async getOccupancyForDate(date: Date, branch?: Branch) {
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    const where: any = {
      checkIn: { lte: target },
      checkOut: { gt: target },
      bookingStatus: { in: ['Confirm', 'Confirmed', 'CheckedIn'] },
    };

    if (branch) {
      where.branch = branch;
    }

    const bookings = await this.prisma.booking.findMany({
      where,
    });

    const totalOccupied = bookings.reduce((sum, b) => sum + b.roomsCount, 0);

    return {
      date: target,
      totalOccupied,
      bookings,
    };
  }
}