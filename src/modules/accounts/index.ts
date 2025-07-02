import { Elysia, Context } from 'elysia';
import { PaymentAccountService } from './service';
import { linkPaymentAccountSchema } from './model';
import { authPlugin, rbac } from '../../plugins/auth.plugin';
import { UserRole } from '@prisma/client';

export class PaymentAccountController {
  static async linkAccount(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    return PaymentAccountService.linkAccount(ctx.user.id, ctx.body);
  }

  static async getMyAccounts(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    return PaymentAccountService.getAccountsByUserId(ctx.user.id);
  }

  static async unlinkAccount(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    return PaymentAccountService.unlinkAccount(ctx.params.id, ctx.user.id);
  }
}

export const paymentAccountModule = new Elysia()
  .use(authPlugin)
  .group('/payment-accounts', (app) =>
    app
      .post('/link', PaymentAccountController.linkAccount, {
        body: linkPaymentAccountSchema,
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.INSTRUCTOR])],
      })
      .get('/', PaymentAccountController.getMyAccounts, {
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.INSTRUCTOR])],
      })
      .delete('/:id', PaymentAccountController.unlinkAccount, {
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.INSTRUCTOR])],
      })
  );
