import { Elysia, Context } from 'elysia';
import { CardService } from './service';
import { registerCardSchema } from './model';
import { authPlugin, rbac } from '../../plugins/auth.plugin';
import { UserRole } from '@prisma/client';

export class CardController {
  static async registerCard(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const { paymentGateway, token, cardType, maskedCard, bank } = ctx.body;
    return CardService.registerCard(ctx.user.id, paymentGateway, token, cardType, maskedCard, bank);
  }

  static async getMyCards(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    return CardService.getCardsByUserId(ctx.user.id);
  }

  static async deleteCard(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const { id } = ctx.params;
    return CardService.deleteCard(id, ctx.user.id);
  }
}

export const cardModule = new Elysia()
  .use(authPlugin)
  .group('/cards', (app) =>
    app
      .post('/register', CardController.registerCard, {
        body: registerCardSchema,
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN])],
      })
      .get('/', CardController.getMyCards, {
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN])],
      })
      .delete('/:id', CardController.deleteCard, {
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN])],
      })
  );
