// src/bookings/bookings.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  BadRequestException,
  Req,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Response } from 'express';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Branch } from '@prisma/client';
import { AuditService } from '../../apps/api/src/audit/audit.service';
import { EmailService } from '../email/email.service';
import * as pdf from 'html-pdf';

@UseGuards(JwtAuthGuard)
@Controller('api/bookings')
export class BookingsController {
  constructor(
    private readonly svc: BookingsService,
    private readonly audit: AuditService,
    private readonly emailService: EmailService,
  ) {}

  @Post()
  async create(@Req() req: any, @Body() dto: any) {
    try {
      const user = req.user;
      let branch: Branch;

      // ✅ Validate branch from request
      if (!dto.branch) {
        throw new BadRequestException('Branch is required');
      }

      if (user.role === 'OWNER') {
        if (!user.branches || !user.branches.includes(dto.branch)) {
          throw new ForbiddenException('Branch not allowed');
        }
        branch = dto.branch;
      } else {
        // For Viewer and Manager, enforce their branch
        const userBranch = user.branches?.[0];
        if (dto.branch && user.branches && !user.branches.includes(dto.branch)) {
          throw new ForbiddenException('You cannot create booking in this branch');
        }
        branch = dto.branch || userBranch;
      }

      // ✅ Ensure branch is set
      if (!branch) {
        throw new BadRequestException('Branch is required');
      }

      console.log(`📝 Creating booking for branch: ${branch} by user: ${user.username} (${user.role})`);

      const booking = await this.svc.create({ ...dto, branch });

      // ✅ Send email confirmation if email exists
      if (booking && booking.email) {
        try {
          if (booking.bookingStatus === 'Pending') {
            await this.emailService.sendBookingRequest(booking.email, booking);
            console.log('📧 Booking request email sent to:', booking.email);
          } else {
            await this.emailService.sendBookingConfirmation(booking.email, booking);
            console.log('📧 Booking confirmation email sent to:', booking.email);
          }
        } catch (emailError) {
          console.error('❌ Email service error:', emailError);
          // Don't fail the booking creation if email fails
        }
      }

      // ✅ Audit log
      try {
        await this.audit.log({
          username: req.context?.username ?? user.username ?? 'system',
          branch: req.context?.branch ?? branch ?? null,
          action: 'CREATE',
          entity: 'Booking',
          entityId: booking.id,
          details: dto,
          ip: req.context?.ip ?? req.ip ?? null,
          userAgent: req.context?.userAgent ?? req.headers['user-agent'] ?? null,
        });
      } catch (auditError) {
        console.error('❌ Audit log error:', auditError);
      }

      return booking;
    } catch (error) {
      console.error('❌ Error creating booking:', error);
      throw error;
    }
  }

  // ✅ PATCH method for status-only updates
  @Patch(':id')
  async updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { bookingStatus: string },
  ) {
    try {
      const user = req.user;
      
      console.log(`📝 Updating status for booking ${id} to ${body.bookingStatus}`);

      // ✅ Only allow status update
      if (!body.bookingStatus) {
        throw new BadRequestException('bookingStatus is required');
      }

      // ✅ Check if booking exists
      const existingBooking = await this.svc.prisma.booking.findUnique({
        where: { id },
      });

      if (!existingBooking) {
        throw new NotFoundException('Booking not found');
      }

      // ✅ Check permission
      if (user.role !== 'OWNER') {
        const userBranch = user.branches?.[0];
        if (existingBooking.branch !== userBranch) {
          throw new ForbiddenException('You cannot update booking in this branch');
        }
      }

      // ✅ Update only the status
      const booking = await this.svc.update(id, { bookingStatus: body.bookingStatus });

      // ✅ Audit log
      try {
        await this.audit.log({
          username: user.username,
          branch: booking.branch,
          action: 'UPDATE_STATUS',
          entity: 'Booking',
          entityId: id,
          details: { newStatus: body.bookingStatus },
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
      } catch (auditError) {
        console.error('❌ Audit log error:', auditError);
      }

      return booking;
    } catch (error) {
      console.error('❌ Error updating status:', error);
      throw error;
    }
  }

  // ✅ PUT method for full updates
  @Put(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    try {
      const user = req.user;
      let branch: Branch;

      console.log('📝 Full update for booking:', id, dto);

      // ✅ Check if booking exists
      const existingBooking = await this.svc.prisma.booking.findUnique({
        where: { id },
      });

      if (!existingBooking) {
        throw new NotFoundException('Booking not found');
      }

      // ✅ Check if this is a status-only update (handled by PATCH)
      const keys = Object.keys(dto);
      const isOnlyStatusUpdate = keys.length === 1 && keys[0] === 'bookingStatus';
      
      if (isOnlyStatusUpdate) {
        console.log('✅ Redirecting to status update');
        return this.updateStatus(req, id, { bookingStatus: dto.bookingStatus });
      }

      // ✅ For full updates, validate branch
      if (user.role === 'OWNER') {
        if (dto.branch && !user.branches.includes(dto.branch)) {
          throw new ForbiddenException('Branch not allowed');
        }
        branch = dto.branch || existingBooking.branch;
      } else {
        const userBranch = user.branches?.[0];
        if (dto.branch && user.branches && !user.branches.includes(dto.branch)) {
          throw new ForbiddenException('You cannot update booking in this branch');
        }
        if (existingBooking.branch !== userBranch) {
          throw new ForbiddenException('You cannot update booking in this branch');
        }
        branch = dto.branch || userBranch || existingBooking.branch;
      }

      if (!branch) {
        throw new BadRequestException('Branch is required');
      }

      const updated = await this.svc.update(id, { ...dto, branch });

      // ✅ Audit log
      try {
        await this.audit.log({
          username: req.context?.username ?? user.username ?? 'system',
          branch: req.context?.branch ?? branch ?? null,
          action: 'UPDATE',
          entity: 'Booking',
          entityId: id,
          details: dto,
          ip: req.context?.ip ?? req.ip ?? null,
          userAgent: req.context?.userAgent ?? req.headers['user-agent'] ?? null,
        });
      } catch (auditError) {
        console.error('❌ Audit log error:', auditError);
      }

      return updated;
    } catch (error) {
      console.error('❌ Error updating booking:', error);
      throw error;
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      console.log('📤 Fetching booking:', id);
      
      let booking = await this.svc.prisma.booking.findUnique({
        where: { id },
      });

      if (!booking) {
        booking = await this.svc.prisma.booking.findFirst({
          where: { bookingNo: id },
        });
      }

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      return booking;
    } catch (error) {
      console.error('Error fetching booking:', error);
      throw error;
    }
  }

  @Get()
  async list(
    @Req() req: any,
    @Query('branch') branch?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('guestName') guestName?: string,
    @Query('roomType') roomType?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ) {
    try {
      const user = req.user;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);

      const where: any = {};

      // ✅ Branch filtering based on user role
      if (user.role === 'OWNER') {
        if (branch) {
          where.branch = branch;
        }
        // Owner can see all branches, so no filter if no branch specified
      } else {
        // Viewer and Manager: only see their assigned branch
        const userBranch = branch || user.branches?.[0];
        if (userBranch) {
          where.branch = userBranch;
        }
      }

      if (from && to) {
        where.checkIn = { gte: new Date(from) };
        where.checkOut = { lte: new Date(to) };
      } else if (from) {
        where.checkIn = { gte: new Date(from) };
      } else if (to) {
        where.checkOut = { lte: new Date(to) };
      }

      if (status) {
        where.bookingStatus = status;
      }

      if (guestName) {
        where.agentName = {
          contains: guestName,
          mode: 'insensitive',
        };
      }

      if (roomType) {
        where.roomType = roomType;
      }

      const total = await this.svc.prisma.booking.count({ where });

      const bookings = await this.svc.prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      });

      console.log(`📋 Found ${bookings.length} bookings for branch: ${where.branch || 'all'}`);

      return {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
        bookings,
        data: bookings, // For compatibility
      };
    } catch (error) {
      console.error('Error listing bookings:', error);
      throw new InternalServerErrorException('Failed to fetch bookings');
    }
  }

  @Get('by-date')
  async byDate(@Req() req: any, @Query('date') date: string, @Query('branch') branch?: string) {
    try {
      if (!date) throw new BadRequestException('date required');
      const user = req.user;

      let targetBranch = branch;
      if (!targetBranch) {
        if (user.role === 'OWNER') {
          targetBranch = user.branches?.[0] || 'Pokhara';
        } else {
          targetBranch = user.branches?.[0] || 'Pokhara';
        }
      }

      // ✅ FIX: Use 'as any' to bypass type checking for branch
      const bookings = await this.svc.prisma.booking.findMany({
        where: {
          branch: targetBranch as any,
          checkIn: {
            lte: new Date(date),
          },
          checkOut: {
            gte: new Date(date),
          },
        },
      });

      return {
        date,
        branch: targetBranch,
        bookings,
        count: bookings.length,
      };
    } catch (error) {
      console.error('Error fetching by date:', error);
      throw error;
    }
  }

  @Get('summary')
  async summary(
    @Req() req: any,
    @Query('month') month: string,
    @Query('branch') branch?: string,
    @Query('single') single = '10',
    @Query('double') double = '10',
    @Query('triple') triple = '10',
    @Query('quard') quard = '10',
  ) {
    try {
      if (!month) throw new BadRequestException('month required (YYYY-MM)');
      const user = req.user;
      const totals = {
        single: Number(single),
        double: Number(double),
        triple: Number(triple),
        quard: Number(quard),
      };

      let targetBranch = branch;
      if (!targetBranch) {
        if (user.role === 'OWNER') {
          targetBranch = user.branches?.[0] || 'Pokhara';
        } else {
          targetBranch = user.branches?.[0] || 'Pokhara';
        }
      }

      // Get summary data
      const startDate = new Date(month + '-01');
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);

      // ✅ FIX: Use 'as any' to bypass type checking for branch
      const bookings = await this.svc.prisma.booking.findMany({
        where: {
          branch: targetBranch as any,
          checkIn: {
            gte: startDate,
          },
          checkOut: {
            lte: endDate,
          },
        },
      });

      return {
        month,
        branch: targetBranch,
        totals,
        bookings,
        count: bookings.length,
        summary: {
          confirmed: bookings.filter(b => b.bookingStatus === 'Confirm' || b.bookingStatus === 'Confirmed').length,
          pending: bookings.filter(b => b.bookingStatus === 'Pending').length,
          checkedIn: bookings.filter(b => b.bookingStatus === 'CheckedIn').length,
          checkedOut: bookings.filter(b => b.bookingStatus === 'CheckedOut').length,
        },
      };
    } catch (error) {
      console.error('Error fetching summary:', error);
      throw error;
    }
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    try {
      // ✅ Check if booking exists
      const existingBooking = await this.svc.prisma.booking.findUnique({
        where: { id },
      });

      if (!existingBooking) {
        throw new NotFoundException('Booking not found');
      }

      // ✅ Check permission
      const user = req.user;
      if (user.role !== 'OWNER') {
        const userBranch = user.branches?.[0];
        if (existingBooking.branch !== userBranch) {
          throw new ForbiddenException('You cannot delete booking in this branch');
        }
      }

      await this.svc.remove(id);

      // ✅ Audit log
      try {
        await this.audit.log({
          username: req.context?.username ?? req.user?.username ?? 'system',
          branch: req.context?.branch ?? req.user?.branches?.[0] ?? null,
          action: 'DELETE',
          entity: 'Booking',
          entityId: id,
          details: null,
          ip: req.context?.ip ?? req.ip ?? null,
          userAgent: req.context?.userAgent ?? req.headers['user-agent'] ?? null,
        });
      } catch (auditError) {
        console.error('❌ Audit log error:', auditError);
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting booking:', error);
      throw error;
    }
  }

  @Get('dashboard/stats')
  async getDashboardStats(@Req() req: any, @Query('branch') branch?: string) {
    try {
      const user = req.user;
      
      // ✅ Determine target branch
      let targetBranch = branch;
      if (!targetBranch) {
        if (user.role === 'OWNER') {
          targetBranch = user.branches?.[0] || 'Pokhara';
        } else {
          targetBranch = user.branches?.[0] || 'Pokhara';
        }
      }

      console.log('📊 Fetching dashboard stats for branch:', targetBranch);
      
      // ✅ Get stats from service
      const stats = await this.svc.getDashboardStats(targetBranch);
      
      return {
        stats: stats || {
          totalRooms: 50,
          occupiedRooms: 0,
          availableRooms: 50,
          totalBookings: 0,
          totalRevenue: 0,
          totalCustomers: 0,
          occupancyPercent: 0,
        },
        branch: targetBranch,
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return {
        stats: {
          totalRooms: 50,
          occupiedRooms: 0,
          availableRooms: 50,
          totalBookings: 0,
          totalRevenue: 0,
          totalCustomers: 0,
          occupancyPercent: 0,
        },
        branch: branch || 'all',
        error: error.message,
      };
    }
  }

  @Get('stats')
  async getStats(@Req() req: any, @Query('branch') branch?: string) {
    try {
      const user = req.user;
      
      let targetBranch = branch;
      if (!targetBranch) {
        if (user.role === 'OWNER') {
          targetBranch = user.branches?.[0] || 'Pokhara';
        } else {
          targetBranch = user.branches?.[0] || 'Pokhara';
        }
      }

      console.log('📊 Fetching booking stats for branch:', targetBranch);
      
      // ✅ Get stats from service
      const result = await this.svc.getBookingStats(targetBranch);
      
      return result || {
        confirmed: 0,
        pending: 0,
        todayCheckIns: 0,
        tomorrowCheckOuts: 0,
        totalRevenue: 0,
        totalCustomers: 0,
        totalBookings: 0,
        branch: targetBranch,
      };
    } catch (error) {
      console.error('Error fetching booking stats:', error);
      return {
        confirmed: 0,
        pending: 0,
        todayCheckIns: 0,
        tomorrowCheckOuts: 0,
        totalRevenue: 0,
        totalCustomers: 0,
        totalBookings: 0,
        branch: branch || 'all',
        error: error.message,
      };
    }
  }
}