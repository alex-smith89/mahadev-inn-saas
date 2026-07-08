import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Branch } from '@prisma/client';

@Injectable()
export class RoomPricingService {
  constructor(private prisma: PrismaService) {}

  async getCurrentSession() {
    const now = new Date();
    const month = now.getMonth() + 1;

    let season = 'Regular';
    let description = 'Regular season pricing';
    let multiplier = 1.0;
    let startDate = new Date();
    let endDate = new Date();

    if (month >= 11 || month <= 2) {
      season = 'Peak';
      description = 'Peak season (Nov - Feb) - High demand';
      multiplier = 1.4;
      startDate = new Date(now.getFullYear(), 10, 1);
      endDate = new Date(now.getFullYear() + (month <= 2 ? 0 : 1), 1, 28);
    } else if (month >= 3 && month <= 5) {
      season = 'Off-Peak';
      description = 'Off-peak season (Mar - May) - Low demand';
      multiplier = 0.85;
      startDate = new Date(now.getFullYear(), 2, 1);
      endDate = new Date(now.getFullYear(), 4, 31);
    } else if (month >= 6 && month <= 7) {
      season = 'Festival';
      description = 'Festival season (Jun - Jul) - High demand';
      multiplier = 1.6;
      startDate = new Date(now.getFullYear(), 5, 1);
      endDate = new Date(now.getFullYear(), 6, 31);
    } else if (month >= 8 && month <= 10) {
      season = 'Regular';
      description = 'Regular season (Aug - Oct) - Normal demand';
      multiplier = 1.0;
      startDate = new Date(now.getFullYear(), 7, 1);
      endDate = new Date(now.getFullYear(), 9, 31);
    }

    return {
      currentSeason: season,
      description,
      multiplier,
      startDate,
      endDate,
      month: month
    };
  }

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

  async getCurrentPricing(branch: Branch, roomType?: string) {
    const currentSession = await this.getCurrentSession();
    const where: any = { 
      branch,
      isActive: true 
    };
    
    if (roomType) {
      where.roomType = roomType;
    }

    let pricing = await this.prisma.roomPricing.findMany({
      where,
      orderBy: { roomType: 'asc' }
    });

    const roomTypes = await this.prisma.roomTypeModel.findMany({
      where: { isActive: true }
    });

    if (pricing.length === 0) {
      for (const rt of roomTypes) {
        const basePrice = rt.basePrice;
        const currentPrice = Math.round(basePrice * currentSession.multiplier);
        
        const newPricing = await this.prisma.roomPricing.create({
          data: {
            branch: branch,
            roomType: rt.name,
            season: currentSession.currentSeason,
            basePrice: basePrice,
            currentPrice: currentPrice,
            isActive: true,
            createdBy: 'system',
            startDate: currentSession.startDate,
            endDate: currentSession.endDate,
          }
        });
        pricing.push(newPricing);
      }
    }

    const result = roomTypes.map(rt => {
      const price = pricing.find(p => p.roomType === rt.name);
      return {
        roomType: rt.name,
        description: rt.description,
        maxOccupancy: rt.maxOccupancy,
        basePrice: rt.basePrice,
        currentPrice: price?.currentPrice || rt.basePrice,
        season: price?.season || currentSession.currentSeason,
        pricingId: price?.id || null,
        isActive: price?.isActive !== undefined ? price.isActive : true,
        session: currentSession
      };
    });

    return {
      branch,
      currentSession,
      pricing: result
    };
  }

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
    const roomTypeExists = await this.prisma.roomTypeModel.findUnique({
      where: { name: roomType }
    });

    if (!roomTypeExists) {
      throw new NotFoundException(`Room type "${roomType}" not found`);
    }

    const existingPricing = await this.prisma.roomPricing.findFirst({
      where: {
        branch,
        roomType,
        season,
        isActive: true
      }
    });

    let pricing;
    let oldPrice = 0;

    if (existingPricing) {
      oldPrice = existingPricing.currentPrice;
      
      pricing = await this.prisma.roomPricing.update({
        where: { id: existingPricing.id },
        data: {
          currentPrice: newPrice,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          updated_at: new Date()
        }
      });
    } else {
      pricing = await this.prisma.roomPricing.create({
        data: {
          branch,
          roomType,
          season,
          basePrice: roomTypeExists.basePrice,
          currentPrice: newPrice,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          isActive: true,
          createdBy: userId || 'system'
        }
      });
      oldPrice = roomTypeExists.basePrice;
    }

    await this.prisma.pricingHistory.create({
      data: {
        branch,
        roomType,
        season,
        oldPrice,
        newPrice,
        changedBy: userId || 'system',
        reason: reason || `Price updated for ${season} season`
      }
    });

    return {
      success: true,
      message: `Price for ${roomType} updated from ${oldPrice} to ${newPrice} for ${season} season`,
      pricing,
      history: {
        oldPrice,
        newPrice,
        season
      }
    };
  }

  async applySessionPricing(
    branch: Branch,
    season: string,
    multiplier: number,
    userId?: string
  ) {
    const roomTypes = await this.prisma.roomTypeModel.findMany({
      where: { isActive: true }
    });

    const results = [];
    for (const rt of roomTypes) {
      const newPrice = Math.round(rt.basePrice * multiplier);
      
      const existingPricing = await this.prisma.roomPricing.findFirst({
        where: {
          branch,
          roomType: rt.name,
          season: season,
          isActive: true
        }
      });

      let oldPrice = rt.basePrice;
      if (existingPricing) {
        oldPrice = existingPricing.currentPrice;
        await this.prisma.roomPricing.update({
          where: { id: existingPricing.id },
          data: {
            currentPrice: newPrice,
            updated_at: new Date()
          }
        });
      } else {
        await this.prisma.roomPricing.create({
          data: {
            branch,
            roomType: rt.name,
            season: season,
            basePrice: rt.basePrice,
            currentPrice: newPrice,
            isActive: true,
            createdBy: userId || 'system',
            startDate: new Date(),
          }
        });
      }

      await this.prisma.pricingHistory.create({
        data: {
          branch,
          roomType: rt.name,
          season,
          oldPrice,
          newPrice,
          changedBy: userId || 'system',
          reason: `Applied ${season} season pricing (${multiplier}x multiplier)`
        }
      });

      results.push({
        roomType: rt.name,
        oldPrice,
        newPrice,
        multiplier
      });
    }

    return {
      success: true,
      message: `Applied ${season} season pricing to all room types`,
      season,
      multiplier,
      results
    };
  }

  async getPricingHistory(branch: Branch, roomType?: string) {
    const where: any = { branch };
    if (roomType) {
      where.roomType = roomType;
    }

    return this.prisma.pricingHistory.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 100
    });
  }

  async getPricingSuggestions(branch: Branch) {
    const currentSession = await this.getCurrentSession();
    const roomTypes = await this.prisma.roomTypeModel.findMany({
      where: { isActive: true }
    });

    const suggestions = [];
    for (const rt of roomTypes) {
      const currentPricing = await this.prisma.roomPricing.findFirst({
        where: {
          branch,
          roomType: rt.name,
          season: currentSession.currentSeason,
          isActive: true
        }
      });

      const suggestedPrice = Math.round(rt.basePrice * currentSession.multiplier);
      const currentPrice = currentPricing?.currentPrice || rt.basePrice;

      suggestions.push({
        roomType: rt.name,
        basePrice: rt.basePrice,
        currentPrice,
        suggestedPrice,
        season: currentSession.currentSeason,
        difference: suggestedPrice - currentPrice,
        percentageChange: ((suggestedPrice - currentPrice) / currentPrice * 100).toFixed(1)
      });
    }

    return {
      branch,
      currentSession,
      suggestions
    };
  }
}