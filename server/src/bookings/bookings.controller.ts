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
import { AuditService } from '../../apps/api/src/audit/audit.service';
import { EmailService } from '../email/email.service';

@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  private readonly logger = new Logger(BookingsController.name);

  constructor(
    private readonly svc: BookingsService,
    private readonly audit: AuditService,
    private readonly emailService: EmailService,
  ) {}

  // ✅ CREATE BOOKING - With Email Notification
  @Post()
  async create(@Req() req: any, @Body() dto: any) {
    try {
      const user = req.user;
      let branch: Branch;

      if (!dto.branch) {
        throw new BadRequestException('Branch is required');
      }

      this.logger.log(`📝 Creating booking by ${user.role}: ${user.username} in branch: ${dto.branch}`);

      // ✅ Allow OWNER and MANAGER to create in ANY branch
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

      // ✅ Create the booking
      const booking = await this.svc.create({ ...dto, branch });

      this.logger.log(`✅ Booking created with ID: ${booking.id}, Booking No: ${booking.bookingNo}`);

      // ✅ Send email confirmation to guest - FIXED duplicate condition
      let emailSent = false;
      let emailStatus = 'no_email';
      
      if (booking && booking.email) {
        try {
          // ✅ Check if booking status is Pending
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
          // ✅ Don't fail the booking creation if email fails
          this.logger.error(`❌ Email sending failed: ${emailError.message}`);
          emailStatus = 'email_failed';
          // You can optionally store the error for retry
        }
      } else {
        this.logger.warn(`⚠️ No email provided for booking ${booking.bookingNo}, skipping email`);
        emailStatus = 'no_email';
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
        this.logger.error('❌ Audit log error:', auditError);
      }

      // ✅ Return response with email status
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
      this.logger.error('❌ Error creating booking:', error);
      throw error;
    }
  }

  // ✅ UPDATE STATUS (PATCH) - With Email Notification
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

      // ✅ Check permission
      if (user.role === 'VIEWER') {
        const userBranch = user.branches?.[0];
        if (existingBooking.branch !== userBranch) {
          throw new ForbiddenException('You cannot update booking in this branch');
        }
      }

      const booking = await this.svc.update(id, { bookingStatus: body.bookingStatus });

      // ✅ Send email on status change to confirmed
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

  // ✅ UPDATE BOOKING (PUT) - With Email Notification
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

      // ✅ Check if only status update
      const keys = Object.keys(dto);
      const isOnlyStatusUpdate = keys.length === 1 && keys[0] === 'bookingStatus';

      if (isOnlyStatusUpdate) {
        return this.updateStatus(req, id, { bookingStatus: dto.bookingStatus });
      }

      // ✅ Check permission for full update
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

      // ✅ Send email notification for updates
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

  // ✅ LIST BOOKINGS - WITH VIEWER SUPPORT
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

      // ✅ Branch filtering based on user role
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

      // ✅ Additional filters
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

  // ✅ DELETE BOOKING
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
      return { success: true };
    } catch (error) {
      this.logger.error('Error deleting booking:', error);
      throw error;
    }
  }

  // ✅ DASHBOARD STATS - WITH VIEWER SUPPORT
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

  // ✅ BOOKING STATS - WITH VIEWER SUPPORT
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

      // ✅ Filter by viewer's branches
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
      
      // ✅ Check if user has permission
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

      // ✅ Send email
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
}