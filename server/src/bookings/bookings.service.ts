
import { Injectable, BadRequestException } from '@nestjs/common';
import { Branch, Booking, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { nanoid } from 'nanoid';

@Injectable()
export class BookingsService {
  constructor(public prisma: PrismaService) {}

  private bookingNo(branch: Branch) {
    const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    return `BKG-${Math.floor(10000 + Math.random() * 90000)}`;
  }

  private nights(ci: Date, co: Date) {
    return Math.max(0, Math.round((co.getTime() - ci.getTime()) / 86400000));
  }   

  async create(data: any): Promise<Booking> {
  if (!/^\+\d{1,4}\d{10}$/.test(String(data.agentContact))) 
    throw new BadRequestException('Agent Contact must be in format +CCXXXXXXXXXX (e.g., +977987654321)');
  
  if (data.mealPlan === 'EPKitchen' && (data.selfCooking == null || isNaN(Number(data.selfCooking)))) {
    throw new BadRequestException('Self Cooking required for EPKitchen');
  }

  const checkIn = new Date(data.checkIn);
  const checkOut = new Date(data.checkOut);
  const nights = this.nights(checkIn, checkOut);
  if (nights < 1) throw new BadRequestException('Check-out must be after check-in');

  // ✅ STEP 1: Fetch branch capacity
  const capacity = await this.prisma.branchCapacity.findUnique({
    where: { branch: data.branch },
  });
  if (!capacity)
    throw new BadRequestException(`No capacity record found for branch: ${data.branch}`);

  // ✅ STEP 2: Calculate overlapping confirmed bookings
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

  const totalBooked = overlapping.reduce((sum, b) => sum + b.roomsCount, 0);

  // ✅ STEP 3: Compare with available capacity
  const maxCap =
    data.roomType === 'Single'
      ? capacity.singleCap
      : data.roomType === 'Double'
      ? capacity.doubleCap
      : 0;

  if (totalBooked + data.roomsCount > maxCap) {
    const available = maxCap - totalBooked;
    throw new BadRequestException(
      `Not enough ${data.roomType} rooms available in ${data.branch}. Only ${available >= 0 ? available : 0
      } left.`,
    );
  }

  // ✅ STEP 4: Proceed with booking
  return this.prisma.booking.create({
    data: {
      bookingNo: this.bookingNo(data.branch),
      agentName: data.agentName,
      agentContact: String(data.agentContact),
      roomsCount: Number(data.roomsCount),
      roomType: data.roomType,
      facility: data.facility,
      price: data.price != null ? Math.trunc(Number(data.price)) : null,
      mealPlan: data.mealPlan,
      selfCooking:
        data.mealPlan === 'EPKitchen' ? Math.trunc(Number(data.selfCooking)) : null,
      checkIn,
      checkOut,
      nights,
      remark: data.remark ?? null,
      branch: data.branch,
      bookingStatus: data.bookingStatus ?? 'Confirm',
    },
  });
}


  async update(id: string, data: any): Promise<Booking> {
  if (!/^\+\d{1,4}\d{10}$/.test(String(data.agentContact))) 
    throw new BadRequestException('Agent Contact must be in format +CCXXXXXXXXXX (e.g., +977987654321)');
  
  if (data.mealPlan === 'EPKitchen' && (data.selfCooking == null || isNaN(Number(data.selfCooking)))) {
    throw new BadRequestException('Self Cooking required for EPKitchen');
  }

  const checkIn = new Date(data.checkIn);
  const checkOut = new Date(data.checkOut);
  const nights = this.nights(checkIn, checkOut);
  if (nights < 1) throw new BadRequestException('Check-out must be after check-in');

  // ✅ STEP 1: Fetch branch capacity
  const capacity = await this.prisma.branchCapacity.findUnique({
    where: { branch: data.branch },
  });
  if (!capacity)
    throw new BadRequestException(`No capacity record found for branch: ${data.branch}`);

  // ✅ STEP 2: Calculate overlapping confirmed bookings (excluding current)
  const overlapping = await this.prisma.booking.findMany({
    where: {
      branch: data.branch,
      roomType: data.roomType,
      bookingStatus: { in: ['Confirm', 'Confirmed'] },
      NOT: { id }, // exclude current booking
      OR: [
        {
          checkIn: { lte: checkOut },
          checkOut: { gte: checkIn },
        },
      ],
    },
  });

  const totalBooked = overlapping.reduce((sum, b) => sum + b.roomsCount, 0);

  // ✅ STEP 3: Compare with available capacity
  const maxCap =
    data.roomType === 'Single'
      ? capacity.singleCap
      : data.roomType === 'Double'
      ? capacity.doubleCap
      : 0;

  if (totalBooked + data.roomsCount > maxCap) {
    const available = maxCap - totalBooked;
    throw new BadRequestException(
      `Not enough ${data.roomType} rooms available in ${data.branch}. Only ${available >= 0 ? available : 0} left.`,
    );
  }

  // ✅ STEP 4: Proceed with booking update
  try {
    return this.prisma.booking.update({
      where: { id },
      data: {
        agentName: data.agentName,
        agentContact: String(data.agentContact),
        roomsCount: Number(data.roomsCount),
        roomType: data.roomType,
        facility: data.facility,
        price: data.price != null ? Math.trunc(Number(data.price)) : null,
        mealPlan: data.mealPlan,
        selfCooking:
          data.mealPlan === 'EPKitchen' ? Math.trunc(Number(data.selfCooking)) : null,
        checkIn,
        checkOut,
        nights,
        remark: data.remark ?? null,
        branch: data.branch,
        bookingStatus: data.bookingStatus ?? 'Confirm',
      },
    });
  } catch (e) {
    console.error('Update payload:', data);
    throw e;
  }
}


  // bookings.service.ts
async list(branch: string, from?: string, to?: string) {
  const where: any = { branch };

  if (from && to) {
    where.checkIn = { gte: new Date(from) };
    where.checkOut = { lte: new Date(to) };
  }

  return this.prisma.booking.findMany({
    where,
    orderBy: { checkIn: 'desc' }, // latest first
  });
} 
async byDate(date: string, branch?: Branch) {
  const target = new Date(date);

  return this.prisma.booking.findMany({
    where: {
      ...(branch ? { branch } : {}),
      checkIn: { lte: target },   // booking already started
      checkOut: { gt: target },   // booking not yet finished
      OR: [
        { bookingStatus: 'Confirm' },
        { bookingStatus: 'Confirmed' },
      ],
    },
    orderBy: { checkIn: 'asc' },
  });
}


  // -----------------------------
  // SUMMARY (updated with new fields + bookingStatus filter)
  // -----------------------------
  async summary(
    month: string,
    branch: Branch,
    totals: { single: number; double: number; triple: number; quard: number }
  ) {
    const start = new Date(`${month}-01T00:00:00Z`);
    const end = new Date(start); end.setMonth(start.getMonth() + 1);

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
        OR: [
          { bookingStatus: 'Confirm' },
          { bookingStatus: 'Confirmed' },
        ],
      },
    ],
  },
});


    const map: Record<
      string,
      { totalOccupied: number; occupancyPercent: number; tomorrowCheckIns: number }
    > = {};

    const capacity = totals.single + totals.double + totals.triple + totals.quard;

    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const tomorrow = new Date(d); tomorrow.setDate(d.getDate() + 1);

      let totalOccupied = 0;
      let tomorrowCheckIns = 0;

      for (const b of bookings) {
        if (b.checkIn <= d && b.checkOut > d) {
          totalOccupied += b.roomsCount;
        }
        if (b.checkIn.toISOString().slice(0, 10) === tomorrow.toISOString().slice(0, 10)) {
          tomorrowCheckIns += b.roomsCount;
        }
      }

      const occupancyPercent = Math.round((totalOccupied / Math.max(1, capacity)) * 100);

      map[key] = { totalOccupied, occupancyPercent, tomorrowCheckIns };
    }

    return map;
  }

  async summaryAll(
    month: string,
    branches: Branch[],
    totalsPerBranch: { single: number; double: number; triple: number; quard: number }
  ) {
    const start = new Date(`${month}-01T00:00:00Z`);
    const end = new Date(start); end.setMonth(start.getMonth() + 1);

    const all: Record<string, { totalOccupied: number; occupancyPercent: number; tomorrowCheckIns: number }> = {};

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

    const perDayCapacity = (totalsPerBranch.single + totalsPerBranch.double + totalsPerBranch.triple + totalsPerBranch.quard) * branches.length;

    for (const k of Object.keys(all)) {
      all[k].occupancyPercent = Math.round((all[k].totalOccupied / Math.max(1, perDayCapacity)) * 100);
    }

    return all;
  }

  // -----------------------------
  // OCCUPANCY (snapshot with bookingStatus filter)
  // -----------------------------
  async occupancyForDate(
    branch: Branch,
    date: string,
    totals: { single: number; double: number; triple: number; quard: number },
  ) {
    const d = new Date(date);
    const rows = await this.prisma.booking.findMany({
      where: {
        branch,
        checkIn: { lte: d },
        checkOut: { gt: d },
        OR: [
          { bookingStatus: 'Confirm' },
          { bookingStatus: 'Confirmed' }
        ],
      },
    });

    let totalOccupied = 0;
    let tomorrowCheckIns = 0;
    const tomorrow = new Date(d); tomorrow.setDate(d.getDate() + 1);

    for (const b of rows) {
      totalOccupied += b.roomsCount;
      if (b.checkIn.toISOString().slice(0, 10) === tomorrow.toISOString().slice(0, 10)) {
        tomorrowCheckIns += b.roomsCount;
      }
    }

    const capacity = totals.single + totals.double + totals.triple + totals.quard || 1;
    const occupancyPercent = Math.round((totalOccupied / capacity) * 100);

    return { totalOccupied, occupancyPercent, tomorrowCheckIns };
  }

  async remove(id: string) {
    await this.prisma.booking.delete({ where: { id } });
  }
  
}
