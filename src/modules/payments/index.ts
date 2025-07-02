import { Elysia, Context, t } from 'elysia';
import { PaymentService } from './service';
import { createPaymentSchema } from './model';
import { authPlugin, rbac } from '../../plugins/auth.plugin';
import { UserRole } from '@prisma/client';
import { paymentWebhooksModule } from './webhooks';

export class PaymentController {
  static async create(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    return PaymentService.create({ ...ctx.body, userId: ctx.user.id });
  }

  static async getPaymentStatus(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const { orderId, paymentGateway } = ctx.params;
    return PaymentService.getPaymentStatus(orderId, paymentGateway as any);
  }
}

export const paymentsModule = new Elysia()
  .use(authPlugin)
  .use(paymentWebhooksModule)
  .group('/payments', (app) =>
    app
      .post('/create', PaymentController.create, {
        body: createPaymentSchema,
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.INSTRUCTOR])],
      })
      .get('/:paymentGateway/:orderId/status', PaymentController.getPaymentStatus, {
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.INSTRUCTOR])],
      })
  );