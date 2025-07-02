import { Elysia, Context, t } from 'elysia';
import { ShopItemService } from './service';
import { createShopItemSchema, updateShopItemSchema, getShopItemsQuerySchema } from './model';
import { authPlugin, rbac } from '../../plugins/auth.plugin';
import { PaymentGateway, ShopItemStatus, UserRole } from '@prisma/client';

export class ShopItemController {
  static async create(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    return ShopItemService.create({ ...ctx.body, sellerId: ctx.user.id });
  }

  static async findAll(ctx: Context) {
    const { sellerId, status, page, limit } = ctx.query;
    const filters = { sellerId, status: status as ShopItemStatus };
    return ShopItemService.findAll(filters, page ? Number(page) : undefined, limit ? Number(limit) : undefined);
  }

  static async findOne(ctx: Context) {
    return ShopItemService.findOne(ctx.params.id);
  }

  static async update(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const shopItem = await ShopItemService.findOne(ctx.params.id);
    if (!shopItem) {
      ctx.set.status = 404;
      return { message: 'Shop item not found' };
    }
    // Only the seller or an admin can update
    if (ctx.user.id !== shopItem.sellerId && ctx.user.role !== UserRole.ADMIN) {
      ctx.set.status = 403;
      return { message: 'Forbidden: You can only update your own shop items.' };
    }
    return ShopItemService.update(ctx.params.id, ctx.body);
  }

  static async delete(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const shopItem = await ShopItemService.findOne(ctx.params.id);
    if (!shopItem) {
      ctx.set.status = 404;
      return { message: 'Shop item not found' };
    }
    // Only the seller or an admin can delete
    if (ctx.user.id !== shopItem.sellerId && ctx.user.role !== UserRole.ADMIN) {
      ctx.set.status = 403;
      return { message: 'Forbidden: You can only delete your own shop items.' };
    }
    return ShopItemService.delete(ctx.params.id);
  }
}

export const shopModule = new Elysia()
  .use(authPlugin)
  .group('/shop', (app) =>
    app
      .post('/', ShopItemController.create, {
        body: createShopItemSchema,
        beforeHandle: [rbac([UserRole.USER, UserRole.INSTRUCTOR, UserRole.ADMIN])],
      })
      .get('/', ShopItemController.findAll, { query: getShopItemsQuerySchema })
      .get('/:id', ShopItemController.findOne)
      .put('/:id', ShopItemController.update, {
        body: updateShopItemSchema,
        beforeHandle: [rbac([UserRole.USER, UserRole.INSTRUCTOR, UserRole.ADMIN])],
      })
      .delete('/:id', ShopItemController.delete, {
        beforeHandle: [rbac([UserRole.USER, UserRole.INSTRUCTOR, UserRole.ADMIN])],
      })
      .post('/:id/purchase', ShopItemController.purchase, {
        body: t.Object({
          quantity: t.Numeric(),
          paymentGateway: t.Enum(PaymentGateway),
        }),
        beforeHandle: [rbac([UserRole.USER])],
      })
  );