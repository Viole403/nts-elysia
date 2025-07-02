import { Elysia, Context, t } from 'elysia';
import { SubscriptionService } from './service';
import { createSubscriptionSchema, updateSubscriptionStatusSchema } from './model';
import { authPlugin, rbac } from '../../plugins/auth.plugin';
import { PaymentGateway, SubscriptionStatus, UserRole } from '@prisma/client';

export class SubscriptionController {
  static async create(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const { plan, paymentGateway } = ctx.body;
    return SubscriptionService.create(ctx.user.id, plan, paymentGateway);
  }

  static async updateStatus(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const { id } = ctx.params;
    const { status } = ctx.body;
    return SubscriptionService.updateStatus(id, status, ctx.user.id);
  }

  static async getMySubscriptions(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    return SubscriptionService.findByUserId(ctx.user.id);
  }
}

export const subscriptionModule = new Elysia()
  .use(authPlugin)
  .group('/subscriptions', (app) =>
    app
      .post('/create', SubscriptionController.create, {
        body: createSubscriptionSchema,
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN])],
      })
      .put('/:id/status', SubscriptionController.updateStatus, {
        body: updateSubscriptionStatusSchema,
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN])],
      })
      .get('/me', SubscriptionController.getMySubscriptions, {
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN])],
      })
  );