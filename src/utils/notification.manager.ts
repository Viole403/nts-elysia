import { prisma } from '../lib/prisma';
import { NotificationType, NotificationEntityType } from '@prisma/client';
import { redis } from '../plugins/redis.plugin';
import { emailService } from '../services/email.service';

export class NotificationManager {
  static async createNotification(
    userId: string,
    type: NotificationType,
    entityId: string,
    entityType: NotificationEntityType,
    message: string
  ) {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        entityId,
        entityType,
        message,
      },
    });

    // Publish to Redis for real-time updates
    await redis.publish(
      `user:${userId}:notifications`,
      JSON.stringify(notification)
    );

    // Send notification email
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.email) {
      await emailService.sendNotificationEmail(user.email, message);
    }

    return notification;
  }
}