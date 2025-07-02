import { Elysia, Context } from 'elysia';
import { ArticleService } from './service';
import { createArticleSchema, updateArticleSchema, getArticlesQuerySchema } from './model';
import { rbac } from '../../plugins/rbac';
import { UserRole } from '@prisma/client';
import { ArticleSubscriptionService } from './subscription/service';

export class ArticleController {
  static async create(ctx: Context) {
    return ArticleService.create({ ...ctx.body, authorId: ctx.user?.id });
  }

  static async findAll(ctx: Context) {
    const { status, authorId, page, limit } = ctx.query;
    const filters = { status, authorId };
    return ArticleService.findAll(filters, page ? Number(page) : undefined, limit ? Number(limit) : undefined);
  }

  static async findOne(ctx: Context, server: any, request: any) {
    const userId = ctx.user?.id;
    const ipAddress = server?.requestIP(request);
    return ArticleService.findOne(ctx.params.slug, userId, ipAddress);
  }

  static async update(ctx: Context) {
    const article = await ArticleService.findOne(ctx.params.slug);
    if (!article) {
      ctx.set.status = 404;
      return { message: 'Article not found' };
    }
    if (ctx.user?.role !== UserRole.ADMIN && ctx.user?.id !== article.authorId) {
      ctx.set.status = 403;
      return { message: 'Forbidden: You can only update your own articles.' };
    }
    return ArticleService.update(ctx.params.slug, ctx.body);
  }

  static async delete(ctx: Context) {
    const article = await ArticleService.findOne(ctx.params.slug);
    if (!article) {
      ctx.set.status = 404;
      return { message: 'Article not found' };
    }
    if (ctx.user?.role !== UserRole.ADMIN && ctx.user?.id !== article.authorId) {
      ctx.set.status = 403;
      return { message: 'Forbidden: You can only delete your own articles.' };
    }
    return ArticleService.delete(ctx.params.slug);
  }

  static async subscribe(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const article = await ArticleService.findOne(ctx.params.slug);
    if (!article) {
      ctx.set.status = 404;
      return { message: 'Article not found' };
    }
    return ArticleSubscriptionService.subscribe(article.id, ctx.user.id);
  }

  static async unsubscribe(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const article = await ArticleService.findOne(ctx.params.slug);
    if (!article) {
      ctx.set.status = 404;
      return { message: 'Article not found' };
    }
    return ArticleSubscriptionService.unsubscribe(article.id, ctx.user.id);
  }
}

export const articlesModule = new Elysia()
  .group('/articles', (app) =>
    app
      .use(rbac([UserRole.INSTRUCTOR, UserRole.ADMIN]))
      .post('/', ArticleController.create, { body: createArticleSchema })
      .get('/', ArticleController.findAll, { query: getArticlesQuerySchema })
      .get('/:slug', ArticleController.findOne)
      .put('/:slug', ArticleController.update, { body: updateArticleSchema })
      .delete('/:slug', ArticleController.delete)
      .post('/:slug/subscribe', ArticleController.subscribe, {
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.INSTRUCTOR])],
      })
      .delete('/:slug/subscribe', ArticleController.unsubscribe, {
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.INSTRUCTOR])],
      })
  );
