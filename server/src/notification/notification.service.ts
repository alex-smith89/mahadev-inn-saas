// src/notification/notification.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    title: string;
    message: string;
    branch?: string;
    bookingId?: string;
    type?: string;
  }) {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          title: data.title,
          message: data.message,
          branch: data.branch || 'All',
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
    if (branch) where.branch = branch;
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
    if (branch) where.branch = branch;

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
    if (branch) where.branch = branch;

    return this.prisma.notification.count({ where });
  }
}