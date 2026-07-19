// src/room-pricing/room-pricing.service.ts
import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Branch } from '@prisma/client';

@Injectable()
export class RoomPricingService {
  private readonly logger = new Logger(RoomPricingService.name);

  constructor(private prisma: PrismaService) {}

  // ✅ Get current pricing for a branch (used by booking form)
  async getCurrentPricing(branch: Branch, roomType?: string) {
    try {
      this.logger.log(`📊 Getting current pricing for branch: ${branch}`);

      // ✅ Get pricing from BranchRoomPricing table (this is the source of truth)
      let branchPricing = await this.prisma.branchRoomPricing.findUnique({
        where: { branch: branch as any },
      });

      // If no pricing exists, create default
      if (!branchPricing) {
        this.logger.log(`📊 Creating default pricing for branch: ${branch}`);
        branchPricing = await this.prisma.branchRoomPricing.create({
          data: {
            branch: branch as any,
            singlePrice: 2000,
            doublePrice: 3000,
            triplePrice: 4500,
            quardPrice: 5500,
            suitePrice: 8000,
            extraPersonPrice: 500,
          },
        });
      }

      // Get room types for display
      const roomTypes = await this.prisma.roomTypeModel.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });

      // ✅ Build pricing array from BranchRoomPricing
      const pricingData = roomTypes.map(rt => {
        let currentPrice = 0;
        let basePrice = 0;
        let description = `${rt.name} room`;

        switch(rt.name) {
          case 'Single':
            currentPrice = branchPricing.singlePrice;
            basePrice = 2000;
            description = 'Standard single room with basic amenities';
            break;
          case 'Double':
            currentPrice = branchPricing.doublePrice;
            basePrice = 3000;
            description = 'Standard double room with comfortable bedding';
            break;
          case 'Triple':
            currentPrice = branchPricing.triplePrice;
            basePrice = 4500;
            description = 'Triple room with three beds';
            break;
          case 'Quard':
            currentPrice = branchPricing.quardPrice;
            basePrice = 5500;
            description = 'Quad room with four beds';
            break;
          case 'Suite':
            currentPrice = branchPricing.suitePrice;
            basePrice = 8000;
            description = 'Luxury suite with premium amenities';
            break;
          default:
            currentPrice = 2000;
            basePrice = 2000;
        }

        return {
          roomType: rt.name,
          description: description,
          maxOccupancy: rt.maxOccupancy || 1,
          basePrice: basePrice,
          currentPrice: currentPrice,
          season: 'Regular',
          pricingId: rt.id,
          isActive: true,
        };
      });

      // Filter out roomType if specified
      const filteredResult = roomType 
        ? pricingData.filter(r => r.roomType === roomType)
        : pricingData;

      // ✅ Filter out Suite if not needed
      const excludedTypes = ['Suite'];
      const finalResult = filteredResult.filter(r => !excludedTypes.includes(r.roomType));

      return {
        branch,
        pricing: finalResult,
        rawPricing: branchPricing,
      };
    } catch (error) {
      this.logger.error(`❌ Error getting current pricing: ${error.message}`);
      throw error;
    }
  }

  // ✅ Update room price - updates BranchRoomPricing table
  async updateRoomPrice(
    branch: Branch,
    roomType: string,
    newPrice: number,
    season: string,
    startDate?: string,
    endDate?: string,
    reason?: string,
    userId?: string
  ) {
    try {
      this.logger.log(`📊 Updating ${roomType} price to ${newPrice} for ${branch}`);

      // Map room type to BranchRoomPricing column
      const columnMap: Record<string, string> = {
        'Single': 'singlePrice',
        'Double': 'doublePrice',
        'Triple': 'triplePrice',
        'Quard': 'quardPrice',
        'Suite': 'suitePrice',
      };

      const column = columnMap[roomType];
      if (!column) {
        throw new NotFoundException(`Invalid room type: ${roomType}`);
      }

      // ✅ Get current price for history
      const existing = await this.prisma.branchRoomPricing.findUnique({
        where: { branch: branch as any },
      });

      const oldPrice = existing ? (existing as any)[column] || 0 : 0;

      // ✅ Update BranchRoomPricing (this is the source of truth)
      const branchPricing = await this.prisma.branchRoomPricing.upsert({
        where: { branch: branch as any },
        update: {
          [column]: newPrice,
          updatedAt: new Date(),
        },
        create: {
          branch: branch as any,
          singlePrice: roomType === 'Single' ? newPrice : 2000,
          doublePrice: roomType === 'Double' ? newPrice : 3000,
          triplePrice: roomType === 'Triple' ? newPrice : 4500,
          quardPrice: roomType === 'Quard' ? newPrice : 5500,
          suitePrice: roomType === 'Suite' ? newPrice : 8000,
          extraPersonPrice: 500,
        },
      });

      // ✅ Log pricing history
      await this.prisma.pricingHistory.create({
        data: {
          branch: branch as any,
          roomType: roomType,
          season: season || 'Regular',
          oldPrice: oldPrice,
          newPrice: newPrice,
          changedBy: userId || 'system',
          reason: reason || `Price updated for ${season} season`,
          created_at: new Date(),
        },
      });

      this.logger.log(`✅ ${roomType} price updated from ${oldPrice} to ${newPrice}`);

      return {
        success: true,
        message: `Price for ${roomType} updated from ${oldPrice} to ${newPrice}`,
        branchPricing,
        oldPrice,
        newPrice,
      };
    } catch (error) {
      this.logger.error(`❌ Error updating room price: ${error.message}`);
      throw error;
    }
  }

  // ✅ Apply season pricing to all room types
  async applySessionPricing(
    branch: Branch,
    season: string,
    multiplier: number,
    userId?: string
  ) {
    try {
      this.logger.log(`📊 Applying ${season} pricing (${multiplier}x) to ${branch}`);

      const basePrices: Record<string, number> = {
        'Single': 2000,
        'Double': 3000,
        'Triple': 4500,
        'Quard': 5500,
        'Suite': 8000,
      };

      const roomTypes = ['Single', 'Double', 'Triple', 'Quard', 'Suite'];
      const updateData: any = { updatedAt: new Date() };
      const oldPrices: Record<string, number> = {};

      // Get current prices
      const existing = await this.prisma.branchRoomPricing.findUnique({
        where: { branch: branch as any },
      });

      for (const rt of roomTypes) {
        const columnMap: Record<string, string> = {
          'Single': 'singlePrice',
          'Double': 'doublePrice',
          'Triple': 'triplePrice',
          'Quard': 'quardPrice',
          'Suite': 'suitePrice',
        };
        const column = columnMap[rt];
        oldPrices[rt] = existing ? (existing as any)[column] || basePrices[rt] : basePrices[rt];
        const newPrice = Math.round(basePrices[rt] * multiplier);
        updateData[column] = newPrice;
      }

      // ✅ Update BranchRoomPricing
      const branchPricing = await this.prisma.branchRoomPricing.upsert({
        where: { branch: branch as any },
        update: updateData,
        create: {
          branch: branch as any,
          singlePrice: Math.round(basePrices.Single * multiplier),
          doublePrice: Math.round(basePrices.Double * multiplier),
          triplePrice: Math.round(basePrices.Triple * multiplier),
          quardPrice: Math.round(basePrices.Quard * multiplier),
          suitePrice: Math.round(basePrices.Suite * multiplier),
          extraPersonPrice: 500,
        },
      });

      // Log history for each room type
      for (const rt of roomTypes) {
        const columnMap: Record<string, string> = {
          'Single': 'singlePrice',
          'Double': 'doublePrice',
          'Triple': 'triplePrice',
          'Quard': 'quardPrice',
          'Suite': 'suitePrice',
        };
        const column = columnMap[rt];
        await this.prisma.pricingHistory.create({
          data: {
            branch: branch as any,
            roomType: rt,
            season: season,
            oldPrice: oldPrices[rt],
            newPrice: updateData[column],
            changedBy: userId || 'system',
            reason: `Applied ${season} season pricing (${multiplier}x multiplier)`,
            created_at: new Date(),
          },
        });
      }

      this.logger.log(`✅ ${season} pricing applied to ${branch}`);

      return {
        success: true,
        message: `Applied ${season} season pricing to all room types`,
        season,
        multiplier,
        branchPricing,
      };
    } catch (error) {
      this.logger.error(`❌ Error applying session pricing: ${error.message}`);
      throw error;
    }
  }

  // ✅ Get pricing history
  async getPricingHistory(branch: Branch, roomType?: string) {
    try {
      const where: any = { branch: branch as any };
      if (roomType) {
        where.roomType = roomType;
      }

      return this.prisma.pricingHistory.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: 100,
      });
    } catch (error) {
      this.logger.error(`❌ Error getting pricing history: ${error.message}`);
      return [];
    }
  }

  // ✅ Get current session
  async getCurrentSession() {
    const now = new Date();
    const month = now.getMonth() + 1;

    let season = 'Regular';
    let description = 'Regular season pricing';
    let multiplier = 1.0;

    if (month >= 11 || month <= 2) {
      season = 'Peak';
      description = 'Peak season (Nov - Feb) - High demand';
      multiplier = 1.4;
    } else if (month >= 3 && month <= 5) {
      season = 'Off-Peak';
      description = 'Off-peak season (Mar - May) - Low demand';
      multiplier = 0.85;
    } else if (month >= 6 && month <= 7) {
      season = 'Festival';
      description = 'Festival season (Jun - Jul) - High demand';
      multiplier = 1.6;
    }

    return {
      currentSeason: season,
      description,
      multiplier,
      month: month,
    };
  }

  // ✅ Get all sessions
  async getAllSessions() {
    return [
      { 
        name: 'Regular', 
        description: 'Regular season - Normal demand',
        multiplier: 1.0,
        months: 'Aug - Oct',
        color: '#6B7280'
      },
      { 
        name: 'Peak', 
        description: 'Peak season - High demand, higher prices',
        multiplier: 1.4,
        months: 'Nov - Feb',
        color: '#EF4444'
      },
      { 
        name: 'Off-Peak', 
        description: 'Off-peak season - Low demand, lower prices',
        multiplier: 0.85,
        months: 'Mar - May',
        color: '#3B82F6'
      },
      { 
        name: 'Festival', 
        description: 'Festival season - Very high demand',
        multiplier: 1.6,
        months: 'Jun - Jul',
        color: '#8B5CF6'
      },
      { 
        name: 'Weekend', 
        description: 'Weekend pricing - Higher rates',
        multiplier: 1.2,
        months: 'Fri - Sun',
        color: '#F59E0B'
      }
    ];
  }

  // ✅ Get room types
  async getRoomTypes() {
    return this.prisma.roomTypeModel.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  // ✅ Get pricing suggestions (for the frontend)
  async getPricingSuggestions(branch: Branch) {
    try {
      const currentSession = await this.getCurrentSession();
      
      // Get current pricing
      const branchPricing = await this.prisma.branchRoomPricing.findUnique({
        where: { branch: branch as any },
      });

      const basePrices: Record<string, number> = {
        'Single': 2000,
        'Double': 3000,
        'Triple': 4500,
        'Quard': 5500,
        'Suite': 8000,
      };

      const roomTypes = ['Single', 'Double', 'Triple', 'Quard', 'Suite'];
      const suggestions = [];

      for (const rt of roomTypes) {
        const currentPrice = branchPricing ? 
          (branchPricing as any)[rt.toLowerCase() + 'Price'] || basePrices[rt] : 
          basePrices[rt];
        const suggestedPrice = Math.round(basePrices[rt] * currentSession.multiplier);

        suggestions.push({
          roomType: rt,
          basePrice: basePrices[rt],
          currentPrice: currentPrice,
          suggestedPrice: suggestedPrice,
          season: currentSession.currentSeason,
          difference: suggestedPrice - currentPrice,
          percentageChange: currentPrice > 0 
            ? ((suggestedPrice - currentPrice) / currentPrice * 100).toFixed(1) 
            : '0',
        });
      }

      return {
        branch,
        currentSession,
        suggestions,
      };
    } catch (error) {
      this.logger.error(`❌ Error getting pricing suggestions: ${error.message}`);
      return { branch, currentSession: await this.getCurrentSession(), suggestions: [] };
    }
  }
}