import { Elysia, Context } from 'elysia';
import { BeneficiaryService } from './service';
import { createBeneficiarySchema, updateBeneficiarySchema } from './model';
import { authPlugin, rbac } from '../../plugins/auth.plugin';
import { UserRole } from '@prisma/client';

export class BeneficiaryController {
  static async create(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    return BeneficiaryService.create({ ...ctx.body, userId: ctx.user.id });
  }

  static async findAll(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    return BeneficiaryService.findAll(ctx.user.id);
  }

  static async update(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    return BeneficiaryService.update(ctx.params.id, ctx.user.id, ctx.body);
  }

  static async delete(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    return BeneficiaryService.delete(ctx.params.id, ctx.user.id);
  }
}

export const beneficiaryModule = new Elysia()
  .use(authPlugin)
  .group('/beneficiaries', (app) =>
    app
      .post('/', BeneficiaryController.create, {
        body: createBeneficiarySchema,
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.INSTRUCTOR])],
      })
      .get('/', BeneficiaryController.findAll, {
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.INSTRUCTOR])],
      })
      .put('/:id', BeneficiaryController.update, {
        body: updateBeneficiarySchema,
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.INSTRUCTOR])],
      })
      .delete('/:id', BeneficiaryController.delete, {
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.INSTRUCTOR])],
      })
  );
