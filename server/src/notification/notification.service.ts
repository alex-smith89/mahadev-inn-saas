// src/notification/notification.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Branch } from '@prisma/client';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    title: string;
    message: string;
    branch?: Branch | string;
    bookingId?: string;
    type?: string;
  }) {
    try {
      // ✅ Convert branch to Branch enum if it's a string
      let branchEnum: Branch | undefined;
      
      if (data.branch) {
        // If branch is a string, check if it's a valid Branch enum value
        if (typeof data.branch === 'string') {
          const validBranches = Object.values(Branch);
          if (validBranches.includes(data.branch as Branch)) {
            branchEnum = data.branch as Branch;
          } else {
            // If invalid branch, default to first branch or handle as needed
            console.warn(`⚠️ Invalid branch: ${data.branch}, defaulting to Pokhara`);
            branchEnum = Branch.Pokhara;
          }
        } else {
          branchEnum = data.branch;
        }
      }

      const notification = await this.prisma.notification.create({
        data: {
          title: data.title,
          message: data.message,
          branch: branchEnum || Branch.Pokhara, // Default to Pokhara if no branch
          bookingId: data.bookingId || null,
          type: data.type || 'general',
          isRead: false,
          createdAt: new Date(),
        },
      });
      
      console.log(`📋 Notification created: ${data.title}`);
      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  }

  async getNotifications(branch?: string, isRead?: string) {
    const where: any = {};
    
    // ✅ Convert branch to Branch enum if provided
    if (branch) {
      const validBranches = Object.values(Branch);
      if (validBranches.includes(branch as Branch)) {
        where.branch = branch as Branch;
      }
    }
    
    if (isRead !== undefined) where.isRead = isRead === 'true';

    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllRead(branch?: string) {
    const where: any = { isRead: false };
    
    // ✅ Convert branch to Branch enum if provided
    if (branch) {
      const validBranches = Object.values(Branch);
      if (validBranches.includes(branch as Branch)) {
        where.branch = branch as Branch;
      }
    }

    await this.prisma.notification.updateMany({
      where,
      data: { isRead: true },
    });
  }

  async deleteNotification(id: string) {
    await this.prisma.notification.delete({ where: { id } });
  }

  async getUnreadCount(branch?: string) {
    const where: any = { isRead: false };
    
    // ✅ Convert branch to Branch enum if provided
    if (branch) {
      const validBranches = Object.values(Branch);
      if (validBranches.includes(branch as Branch)) {
        where.branch = branch as Branch;
      }
    }

    return this.prisma.notification.count({ where });
  }

  // ✅ Helper method to create checkout reminder notification
  async createCheckoutReminder(booking: any, daysUntilCheckout: number) {
    const dayText = daysUntilCheckout === 1 ? 'tomorrow' : `in ${daysUntilCheckout} days`;
    
    return this.create({
      title: `📤 Checkout Reminder - ${daysUntilCheckout} day${daysUntilCheckout > 1 ? 's' : ''}`,
      message: `${booking.agentName} (${booking.bookingNo}) will check out ${dayText} at ${booking.branch}. Room will be vacant.`,
      branch: booking.branch,
      bookingId: booking.id,
      type: 'checkout_reminder',
    });
  }

  // ✅ Helper method to create check-in notification
  async createCheckinNotification(booking: any) {
    return this.create({
      title: '✅ Guest Checked In',
      message: `${booking.agentName} (${booking.bookingNo}) has checked in at ${booking.branch}.`,
      branch: booking.branch,
      bookingId: booking.id,
      type: 'checkin_success',
    });
  }

  // ✅ Helper method to create check-in reminder
  async createCheckinReminder(booking: any) {
    return this.create({
      title: '📅 Check-in Tomorrow',
      message: `${booking.agentName} (${booking.bookingNo}) is scheduled to check-in tomorrow at ${booking.branch}.`,
      branch: booking.branch,
      bookingId: booking.id,
      type: 'checkin_reminder',
    });
  }

  // ✅ Helper method to create checkout notification
  async createCheckoutNotification(booking: any) {
    return this.create({
      title: '📤 Auto Check-out',
      message: `${booking.agentName} (${booking.bookingNo}) has checked out from ${booking.branch}. Room is now vacant.`,
      branch: booking.branch,
      bookingId: booking.id,
      type: 'checkout_success',
    });
  }

  // ✅ Helper method to create room vacant notification
  async createRoomVacantNotification(booking: any) {
    return this.create({
      title: '🛏️ Room Vacant',
      message: `Room at ${booking.branch} is now vacant after ${booking.agentName} (${booking.bookingNo}) checked out.`,
      branch: booking.branch,
      bookingId: booking.id,
      type: 'room_vacant',
    });
  }
}