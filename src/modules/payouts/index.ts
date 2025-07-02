import { Elysia, Context, t } from 'elysia';
import { PayoutService } from './service';
import { createPayoutSchema } from './model';
import { authPlugin, rbac } from '../../plugins/auth.plugin';
import { UserRole } from '@prisma/client';

export class PayoutController {
  static async create(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    return PayoutService.create({ ...ctx.body, userId: ctx.user.id });
  }

  static async getStatus(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    return PayoutService.getStatus(ctx.params.referenceNo, ctx.user.id);
  }
}

export const payoutModule = new Elysia()
  .use(authPlugin)
  .group('/payouts', (app) =>
    app
      .post('/', PayoutController.create, {
        body: createPayoutSchema,
        beforeHandle: [rbac([UserRole.ADMIN, UserRole.INSTRUCTOR])],
      })
      .get('/:referenceNo/status', PayoutController.getStatus, {
        beforeHandle: [rbac([UserRole.ADMIN, UserRole.INSTRUCTOR])],
      })
  );