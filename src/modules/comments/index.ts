import { Elysia, Context } from 'elysia';
import { CommentService } from './service';
import { createCommentSchema, updateCommentSchema, commentVoteSchema, getCommentsQuerySchema } from './model';
import { authPlugin, rbac } from '../../plugins/auth.plugin';
import { UserRole, CommentableType } from '@prisma/client';
import { redisSubscriber } from '../../plugins/redis.plugin';

export class CommentController {
  static async create(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const { entityType, entityId } = ctx.params;
    return CommentService.create({ ...ctx.body, authorId: ctx.user.id, entityType: entityType as CommentableType, entityId });
  }

  static async findAll(ctx: Context) {
    const { entityType, entityId } = ctx.params;
    const { page, limit, sortBy, sortOrder } = ctx.query;
    return CommentService.findAll(
      entityId,
      entityType as CommentableType,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
      sortBy || undefined,
      sortOrder as 'asc' | 'desc' || undefined
    );
  }

  static async findOne(ctx: Context) {
    return CommentService.findOne(ctx.params.id);
  }

  static async update(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const comment = await CommentService.findOne(ctx.params.id);
    if (!comment) {
      ctx.set.status = 404;
      return { message: 'Comment not found' };
    }
    if (ctx.user.role !== UserRole.ADMIN && ctx.user.id !== comment.authorId) {
      ctx.set.status = 403;
      return { message: 'Forbidden: You can only update your own comments.' };
    }
    return CommentService.update(ctx.params.id, ctx.body);
  }

  static async delete(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const comment = await CommentService.findOne(ctx.params.id);
    if (!comment) {
      ctx.set.status = 404;
      return { message: 'Comment not found' };
    }
    if (ctx.user.role !== UserRole.ADMIN && ctx.user.id !== comment.authorId) {
      ctx.set.status = 403;
      return { message: 'Forbidden: You can only delete your own comments.' };
    }
    return CommentService.delete(ctx.params.id);
  }

  static async vote(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const { id } = ctx.params;
    const { voteType } = ctx.body;
    return CommentService.vote(id, ctx.user.id, voteType);
  }

  static async streamComments(ctx: Context) {
    const { entityType, entityId } = ctx.params;
    const channel = `comments:${entityType}:${entityId}`;

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

    (ctx.request as any).raw.on('close', () => {
      subscriber.unsubscribe(channel);
      subscriber.off('message', messageHandler);
      console.log(`Unsubscribed from ${channel}`);
    });

    return new Promise(() => {});
  }

  static async streamCommentVotes(ctx: Context) {
    const { id } = ctx.params;
    const channel = `comments:${id}:votes`;

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
        (ctx as any).end();
        return;
      }
      console.log(`Subscribed to ${count} channel(s). Listening for messages on ${channel}`);
    });

    subscriber.on('message', messageHandler);

    (ctx.request as any).raw.on('close', () => {
      subscriber.unsubscribe(channel);
      subscriber.off('message', messageHandler);
      console.log(`Unsubscribed from ${channel}`);
    });

    return new Promise(() => {});
  }
}

export const commentsModule = new Elysia()
  .use(authPlugin)
  .group('/comments', (app) =>
    app
      .post('/:entityType/:entityId', CommentController.create, {
        body: createCommentSchema,
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.INSTRUCTOR])],
      })
      .get('/:entityType/:entityId', CommentController.findAll, { query: getCommentsQuerySchema })
      .get('/:id', CommentController.findOne)
      .put('/:id', CommentController.update, {
        body: updateCommentSchema,
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.INSTRUCTOR])],
      })
      .delete('/:id', CommentController.delete, {
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.INSTRUCTOR])],
      })
      .post('/:id/vote', CommentController.vote, {
        body: commentVoteSchema,
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.INSTRUCTOR])],
      })
      .get('/:entityType/:entityId/stream', CommentController.streamComments)
      .get('/:id/votes/stream', CommentController.streamCommentVotes)
  );