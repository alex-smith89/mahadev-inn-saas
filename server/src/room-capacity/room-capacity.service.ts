// src/room-capacity/room-capacity.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoomCapacityService {
  private readonly logger = new Logger(RoomCapacityService.name);

  constructor(private prisma: PrismaService) {}

  async getBranchCapacity(branch: string, user: any) {
    try {
      let capacity = await this.prisma.branchCapacity.findUnique({
        where: { branch: branch as any },
      });

      if (!capacity) {
        this.logger.log(`📊 Creating default capacity for branch: ${branch}`);
        capacity = await this.prisma.branchCapacity.create({
          data: {
            branch: branch as any,
            singleCap: 0,
            doubleCap: 0,
            tripleCap: 0,
            quardCap: 0,
            suiteCap: 0,
          },
        });
      }

      return capacity;
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      throw error;
    }
  }

  async updateBranchCapacity(branch: string, body: any, user: any) {
    try {
      this.logger.log(`📊 Updating capacity for branch: ${branch}`);
      this.logger.log(`📊 Data: ${JSON.stringify(body)}`);

      const { singleCap, doubleCap, tripleCap, quardCap, suiteCap } = body;

      const updateData: any = { updatedAt: new Date() };
      if (singleCap !== undefined) updateData.singleCap = Number(singleCap);
      if (doubleCap !== undefined) updateData.doubleCap = Number(doubleCap);
      if (tripleCap !== undefined) updateData.tripleCap = Number(tripleCap);
      if (quardCap !== undefined) updateData.quardCap = Number(quardCap);
      if (suiteCap !== undefined) updateData.suiteCap = Number(suiteCap);

      const capacity = await this.prisma.branchCapacity.upsert({
        where: { branch: branch as any },
        update: updateData,
        create: {
          branch: branch as any,
          singleCap: Number(singleCap) || 0,
          doubleCap: Number(doubleCap) || 0,
          tripleCap: Number(tripleCap) || 0,
          quardCap: Number(quardCap) || 0,
          suiteCap: Number(suiteCap) || 0,
        },
      });

      this.logger.log(`✅ Branch capacity updated for ${branch}`);
      
      await this.syncRoomTypeCapacities(branch, capacity);
      
      // ✅ Create actual rooms for each room type based on capacity
      await this.createRoomsForBranch(branch, capacity);

      return {
        success: true,
        message: 'Branch capacity updated successfully',
        data: capacity,
      };
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      throw error;
    }
  }

  // ✅ Create actual rooms based on capacity
  private async createRoomsForBranch(branch: string, capacity: any) {
    try {
      const roomTypes = [
        { name: 'Single', count: capacity.singleCap || 0, cap: 1 },
        { name: 'Double', count: capacity.doubleCap || 0, cap: 2 },
        { name: 'Triple', count: capacity.tripleCap || 0, cap: 3 },
        { name: 'Quard', count: capacity.quardCap || 0, cap: 4 },
        { name: 'Suite', count: capacity.suiteCap || 0, cap: 4 },
      ];

      const branchPrefix = branch.substring(0, 3).toUpperCase();
      const createdRooms = [];

      for (const rt of roomTypes) {
        if (rt.count === 0) continue;

        // Get existing rooms for this type
        const existingRooms = await this.prisma.room.findMany({
          where: {
            branch: branch as any,
            roomType: rt.name as any,
          },
          orderBy: { roomNumber: 'asc' },
        });

        const existingCount = existingRooms.length;
        const neededCount = rt.count;

        this.logger.log(`📊 ${rt.name}: Existing ${existingCount}, Needed ${neededCount}`);

        // If we need more rooms, create them
        if (neededCount > existingCount) {
          const roomsToCreate = neededCount - existingCount;
          const typePrefix = this.getRoomTypePrefix(rt.name);
          
          const existingNumbers = existingRooms.map(r => {
            const parts = r.roomNumber.split('-');
            return parseInt(parts[2] || '0');
          });
          
          let nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

          for (let i = 0; i < roomsToCreate; i++) {
            const roomNumber = `${branchPrefix}-${typePrefix}-${String(nextNumber++).padStart(3, '0')}`;
            
            try {
              const room = await this.prisma.room.create({
                data: {
                  roomNumber,
                  branch: branch as any,
                  roomType: rt.name as any,
                  capacity: rt.cap,
                  status: 'available',
                  floor: '1',
                  description: `${rt.name} room`,
                },
              });
              createdRooms.push(room);
              this.logger.log(`✅ Created room: ${roomNumber}`);
            } catch (error) {
              this.logger.error(`❌ Failed to create room ${roomNumber}: ${error.message}`);
            }
          }
        }
      }

      this.logger.log(`✅ Created ${createdRooms.length} new rooms for ${branch}`);
      return createdRooms;
    } catch (error) {
      this.logger.error(`❌ Error creating rooms: ${error.message}`);
    }
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

  private async syncRoomTypeCapacities(branch: string, capacity: any) {
    try {
      const roomTypes = [
        { name: 'Single', total: capacity.singleCap || 0 },
        { name: 'Double', total: capacity.doubleCap || 0 },
        { name: 'Triple', total: capacity.tripleCap || 0 },
        { name: 'Quard', total: capacity.quardCap || 0 },
        { name: 'Suite', total: capacity.suiteCap || 0 },
      ];

      for (const rt of roomTypes) {
        await this.prisma.roomTypeCapacity.upsert({
          where: {
            branch_roomType: {
              branch: branch as any,
              roomType: rt.name,
            },
          },
          update: {
            totalRooms: rt.total,
            availableRooms: rt.total,
          },
          create: {
            branch: branch as any,
            roomType: rt.name,
            totalRooms: rt.total,
            occupiedRooms: 0,
            availableRooms: rt.total,
          },
        });
      }

      this.logger.log(`✅ Room type capacities synced for ${branch}`);
    } catch (error) {
      this.logger.error(`❌ Error syncing: ${error.message}`);
    }
  }

  async getRoomTypeCapacities(branch: string, user: any) {
    try {
      let capacities = await this.prisma.roomTypeCapacity.findMany({
        where: { branch: branch as any },
        orderBy: { roomType: 'asc' },
      });

      if (capacities.length === 0) {
        this.logger.log(`📊 Creating default room type capacities for ${branch}`);
        
        const branchCap = await this.getBranchCapacity(branch, user);
        const roomTypes = ['Single', 'Double', 'Triple', 'Quard', 'Suite'];
        const created = [];

        for (const roomType of roomTypes) {
          let totalRooms = 0;
          switch(roomType) {
            case 'Single': totalRooms = branchCap.singleCap || 0; break;
            case 'Double': totalRooms = branchCap.doubleCap || 0; break;
            case 'Triple': totalRooms = branchCap.tripleCap || 0; break;
            case 'Quard': totalRooms = branchCap.quardCap || 0; break;
            case 'Suite': totalRooms = branchCap.suiteCap || 0; break;
          }

          const capacity = await this.prisma.roomTypeCapacity.create({
            data: {
              branch: branch as any,
              roomType: roomType,
              totalRooms: totalRooms,
              occupiedRooms: 0,
              availableRooms: totalRooms,
            },
          });
          created.push(capacity);
        }
        
        return created;
      }

      return capacities;
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      throw error;
    }
  }

  async updateRoomTypeCapacity(branch: string, roomType: string, body: any, user: any) {
    try {
      const { totalRooms } = body;

      if (totalRooms === undefined) {
        throw new BadRequestException('totalRooms is required');
      }

      const capacity = await this.prisma.roomTypeCapacity.upsert({
        where: {
          branch_roomType: {
            branch: branch as any,
            roomType: roomType,
          },
        },
        update: {
          totalRooms: Number(totalRooms),
          availableRooms: Number(totalRooms),
          updated_at: new Date(),
        },
        create: {
          branch: branch as any,
          roomType: roomType,
          totalRooms: Number(totalRooms),
          occupiedRooms: 0,
          availableRooms: Number(totalRooms),
        },
      });

      this.logger.log(`✅ ${roomType} capacity updated for ${branch}`);

      // ✅ Also update branch capacity and create rooms if needed
      const branchCap = await this.prisma.branchCapacity.findUnique({
        where: { branch: branch as any },
      });

      if (branchCap) {
        const capKey = roomType.toLowerCase() + 'Cap';
        const currentCap = (branchCap as any)[capKey] || 0;
        
        if (totalRooms > currentCap) {
          const updateData: any = { updatedAt: new Date() };
          updateData[capKey] = totalRooms;
          
          const updatedBranchCap = await this.prisma.branchCapacity.update({
            where: { branch: branch as any },
            data: updateData,
          });
          
          // Create rooms
          await this.createRoomsForBranch(branch, updatedBranchCap);
        }
      }

      return {
        success: true,
        message: `${roomType} capacity updated successfully`,
        data: capacity,
      };
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      throw error;
    }
  }

  async getCapacitySummary(user: any) {
    try {
      const branchCapacities = await this.prisma.branchCapacity.findMany();
      const summary = [];

      for (const branchCap of branchCapacities) {
        const roomTypes = await this.prisma.roomTypeCapacity.findMany({
          where: { branch: branchCap.branch },
        });

        const totalRooms = 
          (branchCap.singleCap || 0) +
          (branchCap.doubleCap || 0) +
          (branchCap.tripleCap || 0) +
          (branchCap.quardCap || 0) +
          (branchCap.suiteCap || 0);

        const occupiedRooms = roomTypes.reduce((sum, r) => sum + r.occupiedRooms, 0);
        const availableRooms = totalRooms - occupiedRooms;
        const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

        summary.push({
          branch: branchCap.branch,
          totalRooms,
          occupiedRooms,
          availableRooms,
          occupancyRate,
        });
      }

      return summary;
    } catch (error) {
      this.logger.error(`❌ Error: ${error.message}`);
      throw error;
    }
  }

  // ✅ Add this method to check room availability (used by booking)
  async checkRoomAvailability(
    branch: string,
    roomType: string,
    checkIn: Date,
    checkOut: Date,
    roomsNeeded: number
  ) {
    try {
      this.logger.log(`📊 Checking availability for ${roomType} in ${branch}`);

      // Get all rooms of this type in the branch
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

      // Get bookings for these rooms during the date range
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

      const availableCount = availableRooms.length;

      this.logger.log(`📊 Available ${roomType} rooms: ${availableCount} of ${allRooms.length}`);

      return {
        available: availableCount,
        total: allRooms.length,
        booked: bookedRoomIds.size,
        isAvailable: availableCount >= roomsNeeded,
        availableRoomNumbers: availableRooms.map(r => r.roomNumber),
      };
    } catch (error) {
      this.logger.error(`❌ Error checking availability: ${error.message}`);
      throw error;
    }
  }
}