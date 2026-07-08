// src/notification/notification.controller.ts
import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getNotifications(
    @Req() req: any,
    @Query('branch') branch?: string,
    @Query('isRead') isRead?: string,
  ) {
    try {
      const user = req.user;
      let targetBranch = branch;
      if (user.role !== 'OWNER') {
        targetBranch = user.branches?.[0] || branch;
      }

      const notifications = await this.notificationService.getNotifications(
        targetBranch,
        isRead,
      );

      return {
        success: true,
        data: notifications,
        count: notifications.length,
        unreadCount: notifications.filter(n => !n.isRead).length,
      };
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return {
        success: false,
        data: [],
        count: 0,
        unreadCount: 0,
        error: error.message,
      };
    }
  }

  @Get('unread/count')
  async getUnreadCount(@Req() req: any, @Query('branch') branch?: string) {
    try {
      const user = req.user;
      let targetBranch = branch;
      if (user.role !== 'OWNER') {
        targetBranch = user.branches?.[0] || branch;
      }

      const count = await this.notificationService.getUnreadCount(targetBranch);

      return {
        success: true,
        count,
      };
    } catch (error) {
      console.error('Error getting unread count:', error);
      return {
        success: false,
        count: 0,
        error: error.message,
      };
    }
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    try {
      if (!id) {
        throw new BadRequestException('Notification ID is required');
      }

      const notification = await this.notificationService.markAsRead(id);
      
      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      return {
        success: true,
        data: notification,
      };
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Patch('mark-all-read')
  async markAllRead(@Req() req: any, @Query('branch') branch?: string) {
    try {
      const user = req.user;
      let targetBranch = branch;
      if (user.role !== 'OWNER') {
        targetBranch = user.branches?.[0] || branch;
      }

      await this.notificationService.markAllRead(targetBranch);

      return {
        success: true,
        message: 'All notifications marked as read',
      };
    } catch (error) {
      console.error('Error marking all as read:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Delete(':id')
  async deleteNotification(@Param('id') id: string) {
    try {
      if (!id) {
        throw new BadRequestException('Notification ID is required');
      }

      await this.notificationService.deleteNotification(id);

      return {
        success: true,
        message: 'Notification deleted successfully',
      };
    } catch (error) {
      console.error('Error deleting notification:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}