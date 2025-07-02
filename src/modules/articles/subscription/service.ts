import { prisma } from '../../../lib/prisma';
import { NotificationManager } from '../../../utils/notification.manager';
import { NotificationType, NotificationEntityType } from '@prisma/client';
import { redisPublisher } from '../../../plugins/redis.plugin';

export class ArticleSubscriptionService {
  static async subscribe(articleId: string, userId: string) {
    const existingSubscription = await prisma.articleSubscription.findUnique({
      where: {
        articleId_userId: {
          articleId,
          userId,
        },
      },
    });

    if (existingSubscription) {
      throw new Error('Already subscribed to this article.');
    }

    const subscription = await prisma.articleSubscription.create({
      data: {
        articleId,
        userId,
      },
    });

    await redisPublisher.publish(
      `article:${articleId}:subscriptions`,
      JSON.stringify({ type: 'SUBSCRIBED', userId, articleId })
    );

    return subscription;
  }

  static async unsubscribe(articleId: string, userId: string) {
    const deletedSubscription = await prisma.articleSubscription.delete({
      where: {
        articleId_userId: {
          articleId,
          userId,
        },
      },
    });

    await redisPublisher.publish(
      `article:${articleId}:subscriptions`,
      JSON.stringify({ type: 'UNSUBSCRIBED', userId, articleId })
    );

    return deletedSubscription;
  }

  static async notifySubscribers(articleId: string, articleTitle: string) {
    const subscriptions = await prisma.articleSubscription.findMany({
      where: { articleId },
    });

    for (const subscription of subscriptions) {
      await NotificationManager.createNotification(
        subscription.userId,
        NotificationType.POST_MENTION, // Using POST_MENTION as a general update notification type
        articleId,
        NotificationEntityType.ARTICLE,
        `The article '${articleTitle}' you subscribed to has been updated.`
      );
    }

    await redisPublisher.publish(
      `article:${articleId}:updates`,
      JSON.stringify({ type: 'ARTICLE_UPDATED', articleId, title: articleTitle })
    );
  }
}
