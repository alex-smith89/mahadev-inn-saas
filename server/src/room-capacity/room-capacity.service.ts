import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Branch } from '@prisma/client';

@Injectable()
export class RoomCapacityService {
  constructor(private prisma: PrismaService) {}

  // Get branch capacity
  async getBranchCapacity(branch: Branch) {
    const capacity = await this.prisma.branchCapacity.findUnique({
      where: { branch },
    });

    if (!capacity) {
      // Create default capacity if not exists
      return this.prisma.branchCapacity.create({
        data: {
          branch,
          singleCap: 20,
          doubleCap: 30,
          tripleCap: 10,
          quardCap: 5,
        },
      });
    }

    return capacity;
  }

  // Update branch capacity
  async updateBranchCapacity(
    branch: Branch,
    data: {
      singleCap?: number;
      doubleCap?: number;
      tripleCap?: number;
      quardCap?: number;
    }
  ) {
    const existing = await this.prisma.branchCapacity.findUnique({
      where: { branch },
    });

    if (!existing) {
      return this.prisma.branchCapacity.create({
        data: {
          branch,
          singleCap: data.singleCap || 20,
          doubleCap: data.doubleCap || 30,
          tripleCap: data.tripleCap || 10,
          quardCap: data.quardCap || 5,
        },
      });
    }

    return this.prisma.branchCapacity.update({
      where: { branch },
      data: {
        singleCap: data.singleCap !== undefined ? data.singleCap : existing.singleCap,
        doubleCap: data.doubleCap !== undefined ? data.doubleCap : existing.doubleCap,
        tripleCap: data.tripleCap !== undefined ? data.tripleCap : existing.tripleCap,
        quardCap: data.quardCap !== undefined ? data.quardCap : existing.quardCap,
        updatedAt: new Date(),
      },
    });
  }

  // Get all branch capacities
  async getAllBranchCapacities() {
    const capacities = await this.prisma.branchCapacity.findMany({
      orderBy: { branch: 'asc' },
    });

    // Ensure all branches have capacities
    const allBranches = Object.values(Branch);
    const existingBranches = capacities.map(c => c.branch);
    
    for (const branch of allBranches) {
      if (!existingBranches.includes(branch)) {
        const newCapacity = await this.prisma.branchCapacity.create({
          data: {
            branch,
            singleCap: 20,
            doubleCap: 30,
            tripleCap: 10,
            quardCap: 5,
          },
        });
        capacities.push(newCapacity);
      }
    }

    return capacities;
  }

  // Get room type capacity (available rooms per type)
  async getRoomTypeCapacity(branch: Branch) {
    const capacities = await this.prisma.roomTypeCapacity.findMany({
      where: { branch },
    });

    // Get all room types
    const roomTypes = await this.prisma.roomTypeModel.findMany({
      where: { isActive: true },
    });

    // Ensure all room types have capacities
    const existingTypes = capacities.map(c => c.roomType);
    for (const rt of roomTypes) {
      if (!existingTypes.includes(rt.name)) {
        const newCapacity = await this.prisma.roomTypeCapacity.create({
          data: {
            branch,
            roomType: rt.name,
            totalRooms: 10,
            occupiedRooms: 0,
            availableRooms: 10,
          },
        });
        capacities.push(newCapacity);
      }
    }

    // Calculate occupied rooms from bookings
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const bookings = await this.prisma.booking.findMany({
      where: {
        branch,
        bookingStatus: { in: ['Confirm', 'Confirmed', 'CheckedIn'] },
        checkIn: { lte: today },
        checkOut: { gt: today },
      },
    });

    // Update occupied rooms
    for (const cap of capacities) {
      const occupied = bookings
        .filter(b => b.roomType === cap.roomType)
        .reduce((sum, b) => sum + b.roomsCount, 0);
      
      await this.prisma.roomTypeCapacity.update({
        where: { id: cap.id },
        data: {
          occupiedRooms: occupied,
          availableRooms: cap.totalRooms - occupied,
          updated_at: new Date(),
        },
      });
    }

    const updatedCapacities = await this.prisma.roomTypeCapacity.findMany({
      where: { branch },
    });

    return updatedCapacities;
  }

  // Update room type capacity
  async updateRoomTypeCapacity(
    branch: Branch,
    roomType: string,
    totalRooms: number
  ) {
    const existing = await this.prisma.roomTypeCapacity.findFirst({
      where: {
        branch,
        roomType,
      },
    });

    if (!existing) {
      return this.prisma.roomTypeCapacity.create({
        data: {
          branch,
          roomType,
          totalRooms,
          occupiedRooms: 0,
          availableRooms: totalRooms,
        },
      });
    }

    return this.prisma.roomTypeCapacity.update({
      where: { id: existing.id },
      data: {
        totalRooms,
        availableRooms: totalRooms - existing.occupiedRooms,
        updated_at: new Date(),
      },
    });
  }

  // Get capacity summary for dashboard
  async getCapacitySummary() {
    const branches = Object.values(Branch);
    const summary = [];

    for (const branch of branches) {
      const capacity = await this.getBranchCapacity(branch);
      const roomTypeCap = await this.getRoomTypeCapacity(branch);
      
      const totalRooms = capacity.singleCap + capacity.doubleCap + capacity.tripleCap + capacity.quardCap;
      const occupiedRooms = roomTypeCap.reduce((sum, r) => sum + r.occupiedRooms, 0);
      const availableRooms = totalRooms - occupiedRooms;
      const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

      summary.push({
        branch,
        totalRooms,
        occupiedRooms,
        availableRooms,
        occupancyRate,
        roomTypes: roomTypeCap,
      });
    }

    return summary;
  }

  // Check if rooms are available for booking
  async checkAvailability(
    branch: Branch,
    roomType: string,
    roomsCount: number,
    checkIn: Date,
    checkOut: Date
  ) {
    // Get room type capacity
    const capacity = await this.prisma.roomTypeCapacity.findFirst({
      where: {
        branch,
        roomType,
      },
    });

    if (!capacity) {
      return {
        available: false,
        message: `Room type ${roomType} not found in ${branch}`,
        availableRooms: 0,
        requestedRooms: roomsCount,
      };
    }

    // Get overlapping bookings
    const overlapping = await this.prisma.booking.findMany({
      where: {
        branch,
        roomType: roomType as any,
        bookingStatus: { in: ['Confirm', 'Confirmed', 'CheckedIn'] },
        OR: [
          {
            checkIn: { lte: checkOut },
            checkOut: { gte: checkIn },
          },
        ],
      },
    });

    const bookedRooms = overlapping.reduce((sum, b) => sum + b.roomsCount, 0);
    const availableRooms = capacity.totalRooms - bookedRooms;

    return {
      available: availableRooms >= roomsCount,
      availableRooms,
      requestedRooms: roomsCount,
      totalRooms: capacity.totalRooms,
      bookedRooms,
      message: availableRooms >= roomsCount 
        ? `${availableRooms} rooms available` 
        : `Only ${availableRooms} rooms available, requested ${roomsCount}`,
    };
  }
}