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
      this.logger.error(`❌ Error getting branch capacity: ${error.message}`);
      throw error;
    }
  }

  async updateBranchCapacity(branch: string, body: any, user: any) {
    try {
      this.logger.log(`📊 Updating branch capacity for ${branch}:`, body);

      const { singleCap, doubleCap, tripleCap, quardCap, suiteCap } = body;

      // Build update data
      const updateData: any = { updatedAt: new Date() };
      if (singleCap !== undefined) updateData.singleCap = Number(singleCap);
      if (doubleCap !== undefined) updateData.doubleCap = Number(doubleCap);
      if (tripleCap !== undefined) updateData.tripleCap = Number(tripleCap);
      if (quardCap !== undefined) updateData.quardCap = Number(quardCap);
      if (suiteCap !== undefined) updateData.suiteCap = Number(suiteCap);

      this.logger.log(`📊 Update data: ${JSON.stringify(updateData)}`);

      // Update branch capacity
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
      
      // Sync room type capacities
      await this.syncRoomTypeCapacities(branch, capacity);

      return {
        success: true,
        message: 'Branch capacity updated successfully',
        data: capacity,
      };
    } catch (error) {
      this.logger.error(`❌ Error updating branch capacity: ${error.message}`);
      throw error;
    }
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

      this.logger.log(`📊 Syncing room type capacities for ${branch}`);

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
      this.logger.error(`❌ Error syncing room type capacities: ${error.message}`);
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
      this.logger.error(`❌ Error getting room type capacities: ${error.message}`);
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

      return {
        success: true,
        message: `${roomType} capacity updated successfully`,
        data: capacity,
      };
    } catch (error) {
      this.logger.error(`❌ Error updating room type capacity: ${error.message}`);
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
      this.logger.error(`❌ Error getting capacity summary: ${error.message}`);
      throw error;
    }
  }
}