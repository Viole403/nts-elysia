import { Elysia, Context } from 'elysia';
import { NotificationService } from './service';
import { getNotificationsQuerySchema } from './model';
import { rbac } from '../../plugins/rbac';
import { UserRole } from '@prisma/client';
import { redisSubscriber } from '../../plugins/redis.plugin';

export class NotificationController {
  static async getNotifications(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const { isRead } = ctx.query;
    return NotificationService.getNotifications(ctx.user.id, isRead === 'true' ? true : isRead === 'false' ? false : undefined);
  }

  static async markAsRead(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const { id } = ctx.params;
    return NotificationService.markAsRead(id, ctx.user.id);
  }

  static async markAllAsRead(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    return NotificationService.markAllAsRead(ctx.user.id);
  }

  static async streamNotifications(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const userId = ctx.user.id;
    const channel = `user:${userId}:notifications`;

    ctx.set.headers = { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' };

    const subscriber = redisSubscriber;

    const messageHandler = (channel: string, message: string) => {
      if (channel === channel) {
        (ctx as any).write(`data: ${message}\n\n`);
      }
    };

    subscriber.subscribe(channel, (err, count) => {
      if (err) {
        console.error('Failed to subscribe:', err.message);
        // ctx.end(); // ctx.end is not a function on Elysia Context in this scenario
        return;
      }
      console.log(`Subscribed to ${count} channel(s). Listening for messages on ${channel}`);
    });

    subscriber.on('message', messageHandler);

    // Ensure the connection is closed when the client disconnects
    (ctx.request as any).raw.on('close', () => {
      subscriber.unsubscribe(channel);
      subscriber.off('message', messageHandler);
      console.log(`Unsubscribed from ${channel}`);
    });

    // Keep the connection open indefinitely
    return new Promise(() => {});
  }
}

export const notificationsModule = new Elysia()
  .group('/notifications', (app) =>
    app
      .get('/', NotificationController.getNotifications, {
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.INSTRUCTOR])],
      })
      .put('/:id/read', NotificationController.markAsRead, {
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.INSTRUCTOR])],
      })
      .put('/read-all', NotificationController.markAllAsRead, {
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.INSTRUCTOR])],
      })
      .get('/stream', NotificationController.streamNotifications, {
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.INSTRUCTOR])],
      })
  );