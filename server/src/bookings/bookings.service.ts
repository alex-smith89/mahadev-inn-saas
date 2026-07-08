import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Branch, Booking, BookingStatus, MealPlan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RoomTypeEnum } from '@prisma/client';

@Injectable()
export class BookingsService {
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
      throw new BadRequestException('Branch is required');
    }

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

    // ✅ Log the branch being used
    console.log(`📝 Creating booking for branch: ${data.branch}`);

    // Check branch capacity
    const capacity = await this.prisma.branchCapacity.findUnique({
      where: { branch: data.branch },
    });

    if (!capacity) {
      throw new BadRequestException(
        `No capacity record found for branch: ${data.branch}`,
      );
    }

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
        : 0;

    if (totalBooked + data.roomsCount > maxCap) {
      const available = maxCap - totalBooked;
      throw new BadRequestException(
        `Not enough ${data.roomType} rooms available in ${data.branch}. Only ${
          available >= 0 ? available : 0
        } left.`,
      );
    }

    const roomCharges = data.roomCharges || data.price || 0;
    const totalPrice = roomCharges * data.roomsCount * nights;

    // ✅ Create booking with branch properly saved
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
        branch: data.branch, // ✅ Make sure branch is saved
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

    console.log(`✅ Booking created with ID: ${booking.id} for branch: ${booking.branch}`);
    return booking;
  }

  // ---------- UPDATE BOOKING ----------
  async update(id: string, data: any): Promise<Booking> {
    try {
      console.log('📝 Updating booking:', id, data);

      const existing = await this.prisma.booking.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new BadRequestException('Booking not found');
      }

      // ✅ CHECK: If only status update, skip all validation
      // Check if the request only contains bookingStatus
      const keys = Object.keys(data);
      const isOnlyStatusUpdate = keys.length === 1 && keys[0] === 'bookingStatus';
      
      if (isOnlyStatusUpdate) {
        console.log(`✅ Updating only status to: ${data.bookingStatus}`);
        const updated = await this.prisma.booking.update({
          where: { id },
          data: {
            bookingStatus: data.bookingStatus,
          },
        });
        console.log(`✅ Status updated successfully for booking ${id}`);
        return updated;
      }

      // ✅ For full updates, validate all fields
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

      // Check branch capacity
      const capacity = await this.prisma.branchCapacity.findUnique({
        where: { branch: data.branch },
      });

      if (!capacity) {
        throw new BadRequestException(
          `No capacity record found for branch: ${data.branch}`,
        );
      }

      // Check overlapping bookings (excluding current)
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
          : 0;

      if (totalBooked + data.roomsCount > maxCap) {
        const available = maxCap - totalBooked;
        throw new BadRequestException(
          `Not enough ${data.roomType} rooms available in ${data.branch}. Only ${
            available >= 0 ? available : 0
          } left.`,
        );
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
          branch: data.branch, // ✅ Make sure branch is saved on update
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

      console.log(`✅ Booking ${id} updated for branch: ${updated.branch}`);
      return updated;
    } catch (error) {
      console.error('❌ Error updating booking:', error);
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

    console.log(`📋 Found ${bookings.length} bookings for branch: ${branch}`);
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

  // ============================================================
  // ✅ BY DATE METHOD
  // ============================================================
  async byDate(date: string, branch?: Branch) {
    const target = new Date(date);

    const where: any = {
      checkIn: { lte: target },
      checkOut: { gt: target },
      OR: [{ bookingStatus: 'Confirm' }, { bookingStatus: 'Confirmed' }],
    };

    if (branch) {
      where.branch = branch;
    }

    return this.prisma.booking.findMany({
      where,
      orderBy: { checkIn: 'asc' },
    });
  }

  // ============================================================
  // ✅ SUMMARY METHOD
  // ============================================================
  async summary(
    month: string,
    branch: Branch,
    totals: { single: number; double: number; triple: number; quard: number },
  ) {
    const start = new Date(`${month}-01T00:00:00Z`);
    const end = new Date(start);
    end.setMonth(start.getMonth() + 1);

    const bookings = await this.prisma.booking.findMany({
      where: {
        branch,
        AND: [
          {
            OR: [
              { checkIn: { gte: start, lt: end } },
              { checkOut: { gte: start, lt: end } },
            ],
          },
          {
            OR: [{ bookingStatus: 'Confirm' }, { bookingStatus: 'Confirmed' }],
          },
        ],
      },
    });

    const map: Record<
      string,
      { totalOccupied: number; occupancyPercent: number; tomorrowCheckIns: number }
    > = {};

    const capacity =
      totals.single + totals.double + totals.triple + totals.quard;

    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const tomorrow = new Date(d);
      tomorrow.setDate(d.getDate() + 1);

      let totalOccupied = 0;
      let tomorrowCheckIns = 0;

      for (const b of bookings) {
        if (b.checkIn <= d && b.checkOut > d) {
          totalOccupied += b.roomsCount;
        }
        if (
          b.checkIn.toISOString().slice(0, 10) ===
          tomorrow.toISOString().slice(0, 10)
        ) {
          tomorrowCheckIns += b.roomsCount;
        }
      }

      const occupancyPercent = Math.round(
        (totalOccupied / Math.max(1, capacity)) * 100,
      );

      map[key] = { totalOccupied, occupancyPercent, tomorrowCheckIns };
    }

    return map;
  }

  // ============================================================
  // ✅ SUMMARY ALL METHOD
  // ============================================================
  async summaryAll(
    month: string,
    branches: Branch[],
    totalsPerBranch: {
      single: number;
      double: number;
      triple: number;
      quard: number;
    },
  ) {
    const start = new Date(`${month}-01T00:00:00Z`);
    const end = new Date(start);
    end.setMonth(start.getMonth() + 1);

    const all: Record<
      string,
      { totalOccupied: number; occupancyPercent: number; tomorrowCheckIns: number }
    > = {};

    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      all[key] = { totalOccupied: 0, occupancyPercent: 0, tomorrowCheckIns: 0 };
    }

    for (const br of branches) {
      const part = await this.summary(month, br, totalsPerBranch);
      for (const k of Object.keys(part)) {
        all[k].totalOccupied += part[k].totalOccupied;
        all[k].tomorrowCheckIns += part[k].tomorrowCheckIns;
      }
    }

    const perDayCapacity =
      (totalsPerBranch.single +
        totalsPerBranch.double +
        totalsPerBranch.triple +
        totalsPerBranch.quard) *
      branches.length;

    for (const k of Object.keys(all)) {
      all[k].occupancyPercent = Math.round(
        (all[k].totalOccupied / Math.max(1, perDayCapacity)) * 100,
      );
    }

    return all;
  }

  // ============================================================
  // ✅ REMOVE METHOD
  // ============================================================
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
  // ✅ GET BOOKING STATS
  // ============================================================
  async getBookingStats(branch: string) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const allBookings = await this.prisma.booking.findMany({
        where: {
          branch: branch as Branch,
        },
      });

      console.log(`📊 Booking Stats: ${allBookings.length} bookings found for branch: ${branch}`);

      const confirmedBookings = allBookings.filter(
        b => b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed'
      );

      const pendingBookings = allBookings.filter(
        b => b.bookingStatus === 'Pending'
      );

      const todayCheckIns = allBookings.filter(
        b => b.bookingStatus === 'Confirm' && 
        b.checkIn <= today && 
        b.checkOut > today
      );

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowCheckOuts = allBookings.filter(
        b => (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed') &&
        b.checkOut >= tomorrow && 
        b.checkOut < new Date(tomorrow.getTime() + 86400000)
      );

      let totalRevenue = 0;
      confirmedBookings.forEach(b => {
        totalRevenue += (b.price || b.roomCharges || 0);
      });

      const uniqueCustomers = new Set();
      allBookings.forEach(b => {
        if (b.agentName) uniqueCustomers.add(b.agentName);
      });

      console.log(`💰 Total Revenue: ${totalRevenue}, Customers: ${uniqueCustomers.size}`);

      return {
        confirmed: confirmedBookings.length,
        pending: pendingBookings.length,
        todayCheckIns: todayCheckIns.length,
        tomorrowCheckOuts: tomorrowCheckOuts.length,
        totalRevenue: totalRevenue,
        totalCustomers: uniqueCustomers.size,
        totalBookings: allBookings.length,
      };
    } catch (error) {
      console.error('Error in getBookingStats:', error);
      throw error;
    }
  }

  // ============================================================
  // ✅ GET DASHBOARD STATS
  // ============================================================
  async getDashboardStats(branch: string) {
    try {
      console.log(`📊 Fetching dashboard stats for branch: ${branch}`);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // ✅ Fetch bookings with branch filter
      const allBookings = await this.prisma.booking.findMany({
        where: {
          branch: branch as Branch,
        },
      });

      console.log(`📊 Found ${allBookings.length} bookings for branch: ${branch}`);

      const confirmedBookings = allBookings.filter(
        b => b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed'
      );
      console.log(`✅ Confirmed bookings: ${confirmedBookings.length}`);

      const totalBookings = allBookings.length;

      const capacity = await this.prisma.branchCapacity.findUnique({
        where: { branch: branch as Branch },
      });

      // ✅ Calculate total rooms from capacity
      const totalRooms = capacity ? 
        (capacity.singleCap || 0) + 
        (capacity.doubleCap || 0) + 
        (capacity.tripleCap || 0) + 
        (capacity.quardCap || 0) 
        : 50;
      
      // ✅ Calculate occupied rooms based on today's date
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
      console.log(`💰 Total Revenue: ${totalRevenue}`);

      const uniqueCustomers = new Set();
      allBookings.forEach(b => {
        if (b.agentName) uniqueCustomers.add(b.agentName);
      });
      console.log(`👥 Unique Customers: ${uniqueCustomers.size}`);

      // ✅ Calculate today's check-ins
      const todayCheckInsCount = allBookings.filter(
        b => new Date(b.checkIn).toDateString() === today.toDateString() &&
        (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed')
      ).length;

      // ✅ Calculate today's check-outs
      const todayCheckOutsCount = allBookings.filter(
        b => new Date(b.checkOut).toDateString() === today.toDateString()
      ).length;

      // ✅ Calculate active bookings
      const activeBookings = allBookings.filter(
        b => (b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed' || b.bookingStatus === 'CheckedIn') &&
        new Date(b.checkIn) <= today && 
        new Date(b.checkOut) > today
      ).length;

      return {
        success: true,
        branch,
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
      console.error('Error in getDashboardStats:', error);
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
  ) {
    const where: any = { branch: branch as Branch };

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

    console.log(`📋 Found ${bookings.length} bookings for branch: ${branch} (Page ${page})`);

    return {
      bookings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ---------- GET BOOKING WITH FEEDBACK ----------
  async getBookingWithFeedback(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return {
      ...booking,
      feedback: null,
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