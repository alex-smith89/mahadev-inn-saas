import {
  Controller, Get, Post, Put, Delete, Param, Body, Query, Res,
  UseGuards, BadRequestException, Req, ForbiddenException
} from '@nestjs/common';
import { Response } from 'express';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Branch } from '@prisma/client';
import * as puppeteer from 'puppeteer';
import { AuditService } from '../../apps/api/src/audit/audit.service';

@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(
    private svc: BookingsService,
    private audit: AuditService,
  ) {}

  // ---------- Create booking ----------
  @Post()
  async create(@Req() req: any, @Body() dto: any) {
    const user = req.user;
    let branch: Branch;

    if (user.role === 'Owner') {
      if (!user.branches.includes(dto.branch)) {
        throw new ForbiddenException('Branch not allowed');
      }
      branch = dto.branch;
    } else {
      branch = user.branches[0];
    }

    const booking = await this.svc.create({ ...dto, branch });

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

    return booking;
  }

  // ---------- Update booking ----------
  @Put(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    const user = req.user;
    let branch: Branch;

    if (user.role === 'Owner') {
      if (!user.branches.includes(dto.branch)) {
        throw new ForbiddenException('Branch not allowed');
      }
      branch = dto.branch;
    } else {
      branch = user.branches[0];
    }

    const updated = await this.svc.update(id, { ...dto, branch });

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

    return updated;
  }

  // ---------- List bookings ----------
  @Get()
  async list(
    @Req() req: any,
    @Query('branch') branch?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const user = req.user;

    if (user.role === 'Owner') {
      if (branch) {
        return this.svc.list(branch as Branch, from, to);
      }
      return this.svc.prisma.booking.findMany({
        where: {
          ...(from && to
            ? {
                checkIn: { gte: new Date(from) },
                checkOut: { lte: new Date(to) },
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      return this.svc.list(user.branches[0], from, to);
    }
  }

  // ---------- By date ----------
  @Get('by-date')
  async byDate(@Req() req: any, @Query('date') date: string, @Query('branch') branch?: string) {
    if (!date) throw new BadRequestException('date required');
    const user = req.user;

    const branchEnum = branch ? (Branch as any)[branch] ?? branch : undefined;

    if (user.role === 'Owner') {
      if (branchEnum && user.branches.includes(branchEnum)) {
        return this.svc.byDate(date, branchEnum);
      }
      return this.svc.byDate(date);
    } else {
      return this.svc.byDate(date, user.branches[0]);
    }
  }

  // ---------- Summary ----------
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
    if (!month) throw new BadRequestException('month required (YYYY-MM)');
    const user = req.user;
    const totals = { 
      single: Number(single), 
      double: Number(double), 
      triple: Number(triple), 
      quard: Number(quard) 
    };

    if (user.role === 'Owner') {
      if (!branch) {
        return this.svc.summaryAll(month, user.branches, totals);
      }
      const branchEnum = (Branch as any)[branch] ?? branch;
      if (!user.branches.includes(branchEnum)) {
        throw new ForbiddenException('Branch not allowed');
      }
      return this.svc.summary(month, branchEnum, totals);
    }
    return this.svc.summary(month, user.branches[0], totals);
  }

  // ---------- Delete ----------
  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    await this.svc.remove(id);

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

    return { success: true };
  }

  // ---------- PDF ----------
  @Get(':id/pdf')
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const b = await this.svc.prisma.booking.findUnique({ where: { id } });
    if (!b) throw new BadRequestException('Not found');
    const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
      body{font-family:Arial;padding:24px} h1{color:#4f46e5}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #ddd;padding:8px} th{background:#4f46e5;color:#fff}
    </style></head><body>
      <h1>Mahadev Inn — Booking Confirmation</h1>
      <p><b>Booking No:</b> ${b.bookingNo}</p>
      <p><b>Branch:</b> ${b.branch}</p>
      <table>
        <tr><th>Agent</th><td>${b.agentName}</td></tr>
        <tr><th>Contact</th><td>${b.agentContact}</td></tr>
        <tr><th>Rooms</th><td>${b.roomsCount}</td></tr>
        <tr><th>Room Type</th><td>${b.roomType}</td></tr>
        <tr><th>Facility</th><td>${b.facility}</td></tr>
        <tr><th>Price</th><td>${b.price ?? '-'}</td></tr>
        <tr><th>Meal Plan</th><td>${b.mealPlan}</td></tr>
        ${b.mealPlan === 'EPKitchen' ? `<tr><th>Self Cooking</th><td>${b.selfCooking}</td></tr>` : ''}
        <tr><th>Check-In</th><td>${b.checkIn.toISOString().slice(0,10)}</td></tr>
        <tr><th>Check-Out</th><td>${b.checkOut.toISOString().slice(0,10)}</td></tr>
        <tr><th>Nights</th><td>${b.nights}</td></tr>
        <tr><th>Status</th><td>${b.bookingStatus}</td></tr>
        <tr><th>Remark</th><td>${b.remark ?? '-'}</td></tr>
      </table>
    </body></html>`;

    const browser = await (puppeteer as any).launch();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4' });
    await browser.close();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="MahadevInn_Booking_${b.branch}_${b.bookingNo}.pdf"`
    });
    res.send(pdf);
  }
}