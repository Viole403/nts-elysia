import { prisma } from '../../lib/prisma';
import { NotificationType, NotificationEntityType } from '@prisma/client';
import { NotificationManager } from '../../utils/notification.manager';

export class NotificationService {
  static async createNotification(userId: string, type: NotificationType, entityId: string, entityType: NotificationEntityType, message: string) {
    return NotificationManager.createNotification(userId, type, entityId, entityType, message);
  }

  static async getNotifications(userId: string, isRead?: boolean) {
    const where: any = { userId };
    if (isRead !== undefined) {
      where.isRead = isRead;
    }
    return prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  static async markAsRead(notificationId: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  static async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}