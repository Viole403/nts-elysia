import { prisma } from '../../lib/prisma';
import slugify from 'slugify';
import { ArticleStatus } from '@prisma/client';
import { ArticleSubscriptionService } from './subscription/service';
import { redisPublisher } from '../../plugins/redis.plugin';

export class ArticleService {
  static async create(data: any) {
    const { title, content, authorId } = data;
    const slug = slugify(title, { lower: true, strict: true });
    const article = await prisma.article.create({
      data: {
        title,
        content,
        authorId,
        slug,
      },
    });
    return article;
  }

  static async findAll(filters: any, page: number = 1, limit: number = 10) {
    const where: any = {};
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.authorId) {
      where.authorId = filters.authorId;
    }

    const skip = (page - 1) * limit;

    const articles = await prisma.article.findMany({
      where,
      skip,
      take: limit,
    });
    const total = await prisma.article.count({ where });
    return { articles, total, page, limit };
  }

  static async findOne(slug: string, userId?: string, ipAddress?: string) {
    const article = await prisma.article.findUnique({
      where: { slug },
    });

    if (article) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      let existingView;
      if (userId) {
        existingView = await prisma.articleView.findFirst({
          where: {
            articleId: article.id,
            userId,
            viewedAt: { gte: twentyFourHoursAgo },
          },
        });
      } else if (ipAddress) {
        existingView = await prisma.articleView.findFirst({
          where: {
            articleId: article.id,
            ipAddress,
            viewedAt: { gte: twentyFourHoursAgo },
          },
        });
      }

      if (!existingView) {
        await prisma.articleView.create({
          data: {
            articleId: article.id,
            userId,
            ipAddress,
          },
        });
        const updatedArticle = await prisma.article.update({
          where: { slug },
          data: { viewsCount: { increment: 1 } },
        });
        // Publish to Redis for real-time view updates
        await redisPublisher.publish(
          `article:${article.id}:views`,
          JSON.stringify({ type: 'VIEW_INCREMENTED', articleId: article.id, viewsCount: updatedArticle.viewsCount })
        );
      }
    }
    return article;
  }

  static async update(slug: string, data: any) {
    const oldArticle = await prisma.article.findUnique({ where: { slug } });
    const updatedArticle = await prisma.article.update({
      where: { slug },
      data,
    });

    if (oldArticle?.status !== ArticleStatus.PUBLISHED && updatedArticle.status === ArticleStatus.PUBLISHED) {
      await ArticleSubscriptionService.notifySubscribers(updatedArticle.id, updatedArticle.title);
    }

    // Publish to Redis for general article updates
    await redisPublisher.publish(
      `article:${updatedArticle.id}:updates`,
      JSON.stringify({ type: 'ARTICLE_UPDATED', article: updatedArticle })
    );

    return updatedArticle;
  }

  static async delete(slug: string) {
    return prisma.article.delete({
      where: { slug },
    });
  }
}
