import { Elysia, Context, t } from 'elysia';
import { EventService } from './service';
import { createEventSchema, updateEventSchema, getEventsQuerySchema } from './model';
import { authPlugin, rbac } from '../../plugins/auth.plugin';
import { EventStatus, EventType, UserRole } from '@prisma/client';

export class EventController {
  static async create(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    return EventService.create({ ...ctx.body, organizerId: ctx.user.id });
  }

  static async findAll(ctx: Context) {
    const { type, status, organizerId } = ctx.query;
    const filters = { type: type as EventType, status: status as EventStatus, organizerId };
    return EventService.findAll(filters, page ? Number(page) : undefined, limit ? Number(limit) : undefined);
  }

  static async findOne(ctx: Context) {
    return EventService.findOne(ctx.params.id);
  }

  static async update(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const event = await EventService.findOne(ctx.params.id);
    if (!event) {
      ctx.set.status = 404;
      return { message: 'Event not found' };
    }
    // Only the organizer or an admin can update
    if (ctx.user.id !== event.organizerId && ctx.user.role !== UserRole.ADMIN) {
      ctx.set.status = 403;
      return { message: 'Forbidden: You can only update your own events.' };
    }
    return EventService.update(ctx.params.id, ctx.body);
  }

  static async delete(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const event = await EventService.findOne(ctx.params.id);
    if (!event) {
      ctx.set.status = 404;
      return { message: 'Event not found' };
    }
    // Only the organizer or an admin can delete
    if (ctx.user.id !== event.organizerId && ctx.user.role !== UserRole.ADMIN) {
      ctx.set.status = 403;
      return { message: 'Forbidden: You can only delete your own events.' };
    }
    return EventService.delete(ctx.params.id);
  }
}

export const eventModule = new Elysia()
  .use(authPlugin)
  .group('/events', (app) =>
    app
      .post('/', EventController.create, {
        body: createEventSchema,
        beforeHandle: [rbac([UserRole.INSTRUCTOR, UserRole.USER, UserRole.ADMIN])],
      })
      .get('/', EventController.findAll, { query: getEventsQuerySchema })
      .get('/:id', EventController.findOne)
      .put('/:id', EventController.update, {
        body: updateEventSchema,
        beforeHandle: [rbac([UserRole.INSTRUCTOR, UserRole.USER, UserRole.ADMIN])],
      })
      .delete('/:id', EventController.delete, {
        beforeHandle: [rbac([UserRole.INSTRUCTOR, UserRole.USER, UserRole.ADMIN])],
      })
      .post('/:id/attend', EventController.attendEvent, {
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.INSTRUCTOR])],
      })
  );