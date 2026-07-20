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
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Branch } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import * as jsPDF from 'jspdf';

@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  private readonly logger = new Logger(BookingsController.name);

  constructor(
    private readonly svc: BookingsService,
    private readonly audit: AuditService,
    private readonly emailService: EmailService,
  ) {}

  // ✅ CREATE BOOKING - With Audit Log
  @Post()
  async create(@Req() req: any, @Body() dto: any) {
    try {
      const user = req.user;
      let branch: Branch;

      if (!dto.branch) {
        throw new BadRequestException('Branch is required');
      }

      this.logger.log(`📝 Creating booking by ${user.role}: ${user.username} in branch: ${dto.branch}`);

      if (user.role === 'OWNER') {
        branch = dto.branch;
        this.logger.log(`✅ OWNER ${user.username} creating booking in branch: ${branch}`);
      } else if (user.role === 'MANAGER') {
        branch = dto.branch;
        this.logger.log(`✅ MANAGER ${user.username} creating booking in branch: ${branch}`);
      } else if (user.role === 'VIEWER') {
        const userBranch = user.branches?.[0];
        if (dto.branch && user.branches && !user.branches.includes(dto.branch)) {
          throw new ForbiddenException('You cannot create booking in this branch');
        }
        branch = dto.branch || userBranch;
        if (!branch) {
          throw new BadRequestException('No branch assigned to this user');
        }
      } else {
        if (!user.canViewAllBranches && !user.branches?.includes(dto.branch)) {
          throw new ForbiddenException(`You do not have permission to create bookings in branch: ${dto.branch}`);
        }
        branch = dto.branch;
      }

      if (!branch) {
        throw new BadRequestException('Branch is required');
      }

      const booking = await this.svc.create({ ...dto, branch });

      this.logger.log(`✅ Booking created with ID: ${booking.id}, Booking No: ${booking.bookingNo}`);

      // ✅ Create audit log for booking creation
      try {
        await this.audit.log({
          username: user.username || 'system',
          branch: branch,
          action: 'CREATE',
          entity: 'Booking',
          entityId: booking.id,
          details: {
            bookingNo: booking.bookingNo,
            agentName: booking.agentName,
            roomType: booking.roomType,
            roomsCount: booking.roomsCount,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            totalCost: booking.totalCost,
            message: `Booking created by ${user.username} in ${branch}`,
          },
          ip: req.ip || null,
          userAgent: req.headers?.['user-agent'] || null,
        });
        this.logger.log(`✅ Audit log created for booking: ${booking.bookingNo}`);
      } catch (auditError) {
        this.logger.error(`❌ Audit log error: ${auditError.message}`);
      }

      // ✅ Send email confirmation to guest
      let emailSent = false;
      let emailStatus = 'no_email';
      
      if (booking && booking.email) {
        try {
          if (booking.bookingStatus === 'Pending') {
            await this.emailService.sendBookingRequest(booking.email, booking);
            emailSent = true;
            emailStatus = 'request_sent';
            this.logger.log(`📧 Booking request email sent to: ${booking.email}`);
          } else {
            await this.emailService.sendBookingConfirmation(booking.email, booking);
            emailSent = true;
            emailStatus = 'confirmation_sent';
            this.logger.log(`📧 Booking confirmation email sent to: ${booking.email}`);
          }
        } catch (emailError) {
          this.logger.error(`❌ Email sending failed: ${emailError.message}`);
          emailStatus = 'email_failed';
        }
      } else {
        this.logger.warn(`⚠️ No email provided for booking ${booking.bookingNo}, skipping email`);
        emailStatus = 'no_email';
      }

      return {
        success: true,
        data: booking,
        message: `Booking created successfully in ${branch}`,
        branch: branch,
        bookingNo: booking.bookingNo,
        emailSent: emailSent,
        emailStatus: emailStatus,
        email: booking.email || null,
      };
    } catch (error) {
      this.logger.error(`❌ Error creating booking: ${error.message}`);
      this.logger.error(`❌ Stack: ${error.stack}`);
      
      if (error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: error.message || 'Internal server error',
        statusCode: error.status || 500,
      });
    }
  }

  // ✅ CHECK-IN GUEST - With Audit Log
  @Patch(':id/checkin')
  async checkInGuest(@Req() req: any, @Param('id') id: string) {
    try {
      const user = req.user;
      
      const existingBooking = await this.svc.prisma.booking.findUnique({
        where: { id },
      });

      if (!existingBooking) {
        throw new NotFoundException('Booking not found');
      }

      if (user.role === 'VIEWER') {
        const userBranch = user.branches?.[0];
        if (existingBooking.branch !== userBranch) {
          throw new ForbiddenException('You cannot check in guest in this branch');
        }
      }

      const booking = await this.svc.checkInGuest(id);

      // ✅ Create audit log for check-in
      try {
        await this.audit.log({
          username: user.username || 'system',
          branch: booking.branch,
          action: 'CHECK_IN',
          entity: 'Booking',
          entityId: booking.id,
          details: {
            bookingNo: booking.bookingNo,
            agentName: booking.agentName,
            roomType: booking.roomType,
            message: `Guest checked in by ${user.username}`,
          },
          ip: req.ip || null,
          userAgent: req.headers?.['user-agent'] || null,
        });
        this.logger.log(`✅ Audit log created for check-in: ${booking.bookingNo}`);
      } catch (auditError) {
        this.logger.error(`❌ Audit log error: ${auditError.message}`);
      }

      return {
        success: true,
        data: booking,
        message: `Guest checked in successfully: ${booking.agentName} (${booking.bookingNo})`,
      };
    } catch (error) {
      this.logger.error('❌ Error checking in guest:', error);
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to check in guest');
    }
  }

  // ✅ CHECK-OUT GUEST - With Audit Log
  @Patch(':id/checkout')
  async checkOutGuest(@Req() req: any, @Param('id') id: string) {
    try {
      const user = req.user;
      
      const existingBooking = await this.svc.prisma.booking.findUnique({
        where: { id },
      });

      if (!existingBooking) {
        throw new NotFoundException('Booking not found');
      }

      if (user.role === 'VIEWER') {
        const userBranch = user.branches?.[0];
        if (existingBooking.branch !== userBranch) {
          throw new ForbiddenException('You cannot check out guest in this branch');
        }
      }

      const booking = await this.svc.checkOutGuest(id);

      // ✅ Create audit log for check-out
      try {
        await this.audit.log({
          username: user.username || 'system',
          branch: booking.branch,
          action: 'CHECK_OUT',
          entity: 'Booking',
          entityId: booking.id,
          details: {
            bookingNo: booking.bookingNo,
            agentName: booking.agentName,
            roomType: booking.roomType,
            message: `Guest checked out by ${user.username}`,
          },
          ip: req.ip || null,
          userAgent: req.headers?.['user-agent'] || null,
        });
        this.logger.log(`✅ Audit log created for check-out: ${booking.bookingNo}`);
      } catch (auditError) {
        this.logger.error(`❌ Audit log error: ${auditError.message}`);
      }

      return {
        success: true,
        data: booking,
        message: `Guest checked out successfully: ${booking.agentName} (${booking.bookingNo})`,
      };
    } catch (error) {
      this.logger.error('❌ Error checking out guest:', error);
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to check out guest');
    }
  }

  // ✅ UPDATE STATUS - With Audit Log
  @Patch(':id')
  async updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { bookingStatus: string },
  ) {
    try {
      const user = req.user;

      if (!body.bookingStatus) {
        throw new BadRequestException('bookingStatus is required');
      }

      const existingBooking = await this.svc.prisma.booking.findUnique({
        where: { id },
      });

      if (!existingBooking) {
        throw new NotFoundException('Booking not found');
      }

      if (user.role === 'VIEWER') {
        const userBranch = user.branches?.[0];
        if (existingBooking.branch !== userBranch) {
          throw new ForbiddenException('You cannot update booking in this branch');
        }
      }

      const booking = await this.svc.update(id, { bookingStatus: body.bookingStatus });

      // ✅ Create audit log for status update
      try {
        await this.audit.log({
          username: user.username || 'system',
          branch: booking.branch,
          action: 'UPDATE',
          entity: 'Booking',
          entityId: booking.id,
          details: {
            bookingNo: booking.bookingNo,
            oldStatus: existingBooking.bookingStatus,
            newStatus: body.bookingStatus,
            message: `Booking status updated from ${existingBooking.bookingStatus} to ${body.bookingStatus} by ${user.username}`,
          },
          ip: req.ip || null,
          userAgent: req.headers?.['user-agent'] || null,
        });
        this.logger.log(`✅ Audit log created for status update: ${booking.bookingNo}`);
      } catch (auditError) {
        this.logger.error(`❌ Audit log error: ${auditError.message}`);
      }

      if (booking && booking.email && (body.bookingStatus === 'Confirm' || body.bookingStatus === 'Confirmed')) {
        try {
          await this.emailService.sendBookingConfirmation(booking.email, booking);
          this.logger.log(`📧 Status update confirmation email sent to: ${booking.email}`);
        } catch (emailError) {
          this.logger.error(`❌ Email sending failed for status update: ${emailError.message}`);
        }
      }

      return {
        success: true,
        data: booking,
        message: `Booking status updated to ${body.bookingStatus}`,
        emailSent: booking.email ? true : false,
      };
    } catch (error) {
      this.logger.error('❌ Error updating status:', error);
      throw error;
    }
  }

  // ✅ UPDATE BOOKING - With Audit Log
  @Put(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    try {
      const user = req.user;
      let branch: Branch;

      const existingBooking = await this.svc.prisma.booking.findUnique({
        where: { id },
      });

      if (!existingBooking) {
        throw new NotFoundException('Booking not found');
      }

      const keys = Object.keys(dto);
      const isOnlyStatusUpdate = keys.length === 1 && keys[0] === 'bookingStatus';

      if (isOnlyStatusUpdate) {
        return this.updateStatus(req, id, { bookingStatus: dto.bookingStatus });
      }

      if (user.role === 'OWNER') {
        branch = dto.branch || existingBooking.branch;
      } else if (user.role === 'MANAGER') {
        branch = dto.branch || existingBooking.branch;
      } else if (user.role === 'VIEWER') {
        const userBranch = user.branches?.[0];
        if (dto.branch && user.branches && !user.branches.includes(dto.branch)) {
          throw new ForbiddenException('You cannot update booking in this branch');
        }
        if (existingBooking.branch !== userBranch) {
          throw new ForbiddenException('You cannot update booking in this branch');
        }
        branch = dto.branch || userBranch || existingBooking.branch;
      } else {
        branch = dto.branch || existingBooking.branch;
      }

      if (!branch) {
        throw new BadRequestException('Branch is required');
      }

      const updated = await this.svc.update(id, { ...dto, branch });

      // ✅ Create audit log for update
      try {
        await this.audit.log({
          username: user.username || 'system',
          branch: branch,
          action: 'UPDATE',
          entity: 'Booking',
          entityId: updated.id,
          details: {
            bookingNo: updated.bookingNo,
            agentName: updated.agentName,
            roomType: updated.roomType,
            message: `Booking updated by ${user.username}`,
          },
          ip: req.ip || null,
          userAgent: req.headers?.['user-agent'] || null,
        });
        this.logger.log(`✅ Audit log created for update: ${updated.bookingNo}`);
      } catch (auditError) {
        this.logger.error(`❌ Audit log error: ${auditError.message}`);
      }

      if (updated && updated.email) {
        try {
          await this.emailService.sendBookingConfirmation(updated.email, updated);
          this.logger.log(`📧 Update confirmation email sent to: ${updated.email}`);
        } catch (emailError) {
          this.logger.error(`❌ Email sending failed for update: ${emailError.message}`);
        }
      }

      return {
        success: true,
        data: updated,
        message: 'Booking updated successfully',
        emailSent: updated.email ? true : false,
      };
    } catch (error) {
      this.logger.error('❌ Error updating booking:', error);
      throw error;
    }
  }

  // ✅ DELETE BOOKING - With Audit Log
  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    try {
      const existingBooking = await this.svc.prisma.booking.findUnique({
        where: { id },
      });

      if (!existingBooking) {
        throw new NotFoundException('Booking not found');
      }

      const user = req.user;
      if (user.role !== 'OWNER') {
        throw new ForbiddenException('Only owners can delete bookings');
      }

      await this.svc.remove(id);

      // ✅ Create audit log for delete
      try {
        await this.audit.log({
          username: user.username || 'system',
          branch: existingBooking.branch,
          action: 'DELETE',
          entity: 'Booking',
          entityId: existingBooking.id,
          details: {
            bookingNo: existingBooking.bookingNo,
            agentName: existingBooking.agentName,
            message: `Booking deleted by ${user.username}`,
          },
          ip: req.ip || null,
          userAgent: req.headers?.['user-agent'] || null,
        });
        this.logger.log(`✅ Audit log created for delete: ${existingBooking.bookingNo}`);
      } catch (auditError) {
        this.logger.error(`❌ Audit log error: ${auditError.message}`);
      }

      return { success: true };
    } catch (error) {
      this.logger.error('Error deleting booking:', error);
      throw error;
    }
  }

  // ✅ GET SINGLE BOOKING
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
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
      this.logger.error('Error fetching booking:', error);
      throw error;
    }
  }

  // ✅ LIST BOOKINGS
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

      this.logger.log(`📋 User ${user.username} (${user.role}) listing bookings`);
      this.logger.log(`📋 User branches: ${user.branches?.join(', ') || 'none'}`);

      if (user.role === 'OWNER') {
        if (branch) {
          where.branch = branch;
        }
      } else if (user.role === 'MANAGER') {
        if (branch) {
          where.branch = branch;
        }
      } else if (user.role === 'VIEWER') {
        const userBranches = user.branches || [];
        if (userBranches.length === 0) {
          return {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            totalPages: 0,
            bookings: [],
            data: [],
          };
        }
        if (branch && userBranches.includes(branch)) {
          where.branch = branch;
        } else {
          where.branch = { in: userBranches };
        }
        this.logger.log(`📋 Viewer viewing branches: ${userBranches.join(', ')}`);
      } else {
        const userBranches = user.branches || [];
        if (userBranches.length > 0) {
          where.branch = { in: userBranches };
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

      this.logger.log(`📋 Found ${bookings.length} bookings for user ${user.username}`);

      return {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
        bookings,
        data: bookings,
      };
    } catch (error) {
      this.logger.error('Error listing bookings:', error);
      throw new InternalServerErrorException('Failed to fetch bookings');
    }
  }

  // ✅ DASHBOARD STATS
  @Get('dashboard/stats')
  async getDashboardStats(@Req() req: any, @Query('branch') branch?: string) {
    try {
      const user = req.user;

      let targetBranch = branch;
      if (!targetBranch) {
        if (user.role === 'OWNER' || user.role === 'MANAGER') {
          targetBranch = branch || 'all';
        } else {
          targetBranch = user.branches?.[0] || 'Pokhara';
        }
      }

      const stats = await this.svc.getDashboardStats(targetBranch, user);

      return {
        stats: stats?.stats || {
          totalRooms: 50,
          occupiedRooms: 0,
          availableRooms: 50,
          totalBookings: 0,
          totalRevenue: 0,
          totalCustomers: 0,
          occupancyPercent: 0,
        },
        branch: targetBranch || 'all',
      };
    } catch (error) {
      this.logger.error('Error fetching dashboard stats:', error);
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

  // ✅ BOOKING STATS
  @Get('stats')
  async getStats(@Req() req: any, @Query('branch') branch?: string) {
    try {
      const user = req.user;

      let targetBranch = branch;
      if (!targetBranch) {
        if (user.role === 'OWNER' || user.role === 'MANAGER') {
          targetBranch = branch || 'all';
        } else {
          targetBranch = user.branches?.[0] || 'Pokhara';
        }
      }

      const result = await this.svc.getBookingStats(targetBranch, user);

      return result || {
        confirmed: 0,
        pending: 0,
        todayCheckIns: 0,
        tomorrowCheckOuts: 0,
        totalRevenue: 0,
        totalCustomers: 0,
        totalBookings: 0,
        branch: targetBranch || 'all',
      };
    } catch (error) {
      this.logger.error('Error fetching booking stats:', error);
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

  // ✅ TODAY'S CHECK-INS
  @Get('checkin/today')
  async getTodayCheckins(@Req() req: any) {
    try {
      const user = req.user;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let where: any = {
        checkIn: { gte: today, lt: tomorrow },
        bookingStatus: { in: ['Confirm', 'Confirmed', 'Pending'] },
      };

      if (user.role === 'VIEWER') {
        const userBranches = user.branches || [];
        if (userBranches.length === 0) {
          return { success: true, data: [] };
        }
        where.branch = { in: userBranches };
      }

      const bookings = await this.svc.prisma.booking.findMany({
        where,
        orderBy: { checkIn: 'asc' },
      });

      return { success: true, data: bookings };
    } catch (error) {
      this.logger.error('Error fetching today checkins:', error);
      throw new InternalServerErrorException('Failed to fetch today checkins');
    }
  }

  // ✅ TOMORROW'S CHECK-INS
  @Get('checkin/tomorrow')
  async getTomorrowCheckins(@Req() req: any) {
    try {
      const user = req.user;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);

      let where: any = {
        checkIn: { gte: tomorrow, lt: dayAfter },
        bookingStatus: { in: ['Confirm', 'Confirmed', 'Pending'] },
      };

      if (user.role === 'VIEWER') {
        const userBranches = user.branches || [];
        if (userBranches.length === 0) {
          return { success: true, data: [] };
        }
        where.branch = { in: userBranches };
      }

      const bookings = await this.svc.prisma.booking.findMany({
        where,
        orderBy: { checkIn: 'asc' },
      });

      return { success: true, data: bookings };
    } catch (error) {
      this.logger.error('Error fetching tomorrow checkins:', error);
      throw new InternalServerErrorException('Failed to fetch tomorrow checkins');
    }
  }

  // ✅ UPCOMING CHECKOUTS
  @Get('checkout/upcoming')
  async getUpcomingCheckouts(@Req() req: any) {
    try {
      const user = req.user;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + 7);

      let where: any = {
        checkOut: { gte: today, lt: futureDate },
        bookingStatus: { in: ['Confirm', 'Confirmed', 'CheckedIn'] },
      };

      if (user.role === 'VIEWER') {
        const userBranches = user.branches || [];
        if (userBranches.length === 0) {
          return { success: true, data: [] };
        }
        where.branch = { in: userBranches };
      }

      const bookings = await this.svc.prisma.booking.findMany({
        where,
        orderBy: { checkOut: 'asc' },
      });

      return { success: true, data: bookings };
    } catch (error) {
      this.logger.error('Error fetching upcoming checkouts:', error);
      throw new InternalServerErrorException('Failed to fetch upcoming checkouts');
    }
  }

  // ✅ RESEND CONFIRMATION EMAIL
  @Post(':id/resend-email')
  async resendConfirmationEmail(@Req() req: any, @Param('id') id: string) {
    try {
      const user = req.user;
      
      if (user.role === 'VIEWER') {
        throw new ForbiddenException('You do not have permission to resend emails');
      }

      const booking = await this.svc.prisma.booking.findUnique({
        where: { id },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (!booking.email) {
        throw new BadRequestException('No email associated with this booking');
      }

      await this.emailService.sendBookingConfirmation(booking.email, booking);
      this.logger.log(`📧 Confirmation email resent to: ${booking.email}`);

      return {
        success: true,
        message: `Confirmation email resent to ${booking.email}`,
        email: booking.email,
      };
    } catch (error) {
      this.logger.error('Error resending email:', error);
      throw error;
    }
  }

  // ✅ GENERATE PDF
  @Get(':id/pdf')
  async generatePdf(@Param('id') id: string, @Res() res: Response) {
    try {
      this.logger.log(`📄 Generating PDF for booking: ${id}`);

      let booking = await this.svc.prisma.booking.findUnique({
        where: { id },
      });

      if (!booking) {
        booking = await this.svc.prisma.booking.findFirst({
          where: { bookingNo: id },
        });
      }

      if (!booking) {
        this.logger.error(`❌ Booking not found: ${id}`);
        return res.status(404).json({ error: 'Booking not found' });
      }

      this.logger.log(`✅ Found booking: ${booking.bookingNo}`);

      const doc = new jsPDF.jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 15;

      const primaryColor = [79, 70, 229];
      const secondaryColor = [31, 41, 55];
      const lightGray = [107, 114, 128];

      // Header
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(2);
      doc.line(15, 10, pageWidth - 15, 10);

      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('MAHADEV INN', pageWidth / 2, y, { align: 'center' });
      y += 8;

      doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Booking Confirmation Receipt', pageWidth / 2, y, { align: 'center' });
      y += 10;

      // Booking Details
      doc.setFillColor(245, 245, 255);
      doc.rect(15, y - 2, pageWidth - 30, 8, 'F');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('BOOKING DETAILS', 20, y + 3);
      y += 12;

      const addRow = (label: string, value: string) => {
        doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(label + ':', 20, y + 3);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(String(value), 70, y + 3);
        y += 8;
      };

      addRow('Booking No', booking.bookingNo);
      addRow('Guest Name', booking.agentName);
      addRow('Contact', booking.agentContact);
      addRow('Email', booking.email || 'N/A');
      addRow('Branch', booking.branch);
      addRow('Room Type', booking.roomType);
      addRow('Rooms', String(booking.roomsCount));
      addRow('Heads', String(booking.heads));

      const checkInDate = new Date(booking.checkIn).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const checkOutDate = new Date(booking.checkOut).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      addRow('Check In', checkInDate);
      addRow('Check Out', checkOutDate);
      addRow('Nights', String(booking.nights));

      // Price Summary
      y += 4;
      doc.setFillColor(245, 245, 255);
      doc.rect(15, y - 2, pageWidth - 30, 8, 'F');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('PRICE SUMMARY', 20, y + 3);
      y += 12;

      const totalCost = Number(booking.totalCost) || Number(booking.roomCharges) || 0;
      const vatAmount = totalCost * 0.13;
      const grandTotal = totalCost + vatAmount;

      addRow('Room Charges', `Rs. ${totalCost.toFixed(2)}`);
      addRow('VAT (13%)', `Rs. ${vatAmount.toFixed(2)}`);
      
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(18, y - 1, pageWidth - 36, 9, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('GRAND TOTAL', 22, y + 4);
      doc.text(`Rs. ${grandTotal.toFixed(2)}`, pageWidth - 20, y + 4, { align: 'right' });
      y += 14;

      // Footer
      y += 4;
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.3);
      doc.line(15, y, pageWidth - 15, y);
      y += 10;

      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Thank You!', pageWidth / 2, y, { align: 'center' });
      y += 8;

      doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('For choosing Mahadev Inn. We look forward to welcoming you!', pageWidth / 2, y, { align: 'center' });
      y += 6;

      doc.setFontSize(8);
      doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.text('This is a system-generated receipt. Please keep it for your records.', pageWidth / 2, y, { align: 'center' });
      y += 4;

      doc.setFontSize(7);
      doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.text('+977 1 4785959  |  info@mahadevin.com  |  www.mahadevin.com', pageWidth / 2, y, { align: 'center' });

      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(2);
      doc.line(15, y + 10, pageWidth - 15, y + 10);

      const pdfBuffer = doc.output('arraybuffer');

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=MahadevInn_Booking_${booking.bookingNo}.pdf`,
        'Content-Length': pdfBuffer.byteLength,
      });

      res.send(Buffer.from(pdfBuffer));
      
      this.logger.log(`✅ PDF generated successfully for booking: ${booking.bookingNo}`);
    } catch (error) {
      this.logger.error(`❌ Error generating PDF: ${error.message}`);
      this.logger.error(`❌ Stack trace: ${error.stack}`);
      
      return res.status(500).json({ 
        error: 'Failed to generate PDF', 
        message: error.message 
      });
    }
  }
}