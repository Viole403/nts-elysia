import { Elysia, Context, t } from 'elysia';
import { ReactionService } from './service';
import { createReactionSchema } from './model';
import { authPlugin, rbac } from '../../plugins/auth.plugin';
import { UserRole, ReactableType, ReactionType } from '@prisma/client';
import { redisSubscriber } from '../../plugins/redis.plugin';

export class ReactionController {
  static async toggleReaction(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const { entityType, entityId } = ctx.params;
    const { reactionType } = ctx.body;
    return ReactionService.toggleReaction(ctx.user.id, entityId, entityType as ReactableType, reactionType as ReactionType);
  }

  static async streamReactions(ctx: Context) {
    const { entityType, entityId } = ctx.params;
    const channel = `reactions:${entityType}:${entityId}`;

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

export const reactionsModule = new Elysia()
  .use(authPlugin)
  .group('/reactions', (app) =>
    app
      .post('/:entityType/:entityId', ReactionController.toggleReaction, {
        body: createReactionSchema,
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.INSTRUCTOR])],
      })
      .get('/:entityType/:entityId/stream', ReactionController.streamReactions)
  );