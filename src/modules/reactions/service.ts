import { prisma } from '../../lib/prisma';
import { ReactableType, ReactionType, NotificationType, NotificationEntityType } from '@prisma/client';
import { NotificationManager } from '../../utils/notification.manager';
import { redisPublisher } from '../../plugins/redis.plugin';

export class ReactionService {
  static async toggleReaction(userId: string, entityId: string, entityType: ReactableType, reactionType: ReactionType) {
    const existingReaction = await prisma.reaction.findUnique({
      where: {
        userId_entityId_entityType: {
          userId,
          entityId,
          entityType,
        },
      },
    });

    let updatedEntity;

    if (existingReaction) {
      // If reaction exists, delete it (toggle off)
      await prisma.reaction.delete({
        where: {
          id: existingReaction.id,
        },
      });

      // Decrement likesCount if applicable
      if (entityType === ReactableType.ARTICLE) {
        updatedEntity = await prisma.article.update({
          where: { id: entityId },
          data: { likesCount: { decrement: 1 } },
        });
      } else if (entityType === ReactableType.GROUP_POST) {
        updatedEntity = await prisma.groupPost.update({
          where: { id: entityId },
          data: { likesCount: { decrement: 1 } },
        });
      }

      // Publish to Redis for real-time updates
      await redisPublisher.publish(
        `reactions:${entityType}:${entityId}`,
        JSON.stringify({ type: 'REACTION_REMOVED', userId, entityId, entityType, reactionType })
      );

      return { reaction: null, updatedEntity };
    } else {
      // If reaction does not exist, create it (toggle on)
      const newReaction = await prisma.reaction.create({
        data: {
          userId,
          entityId,
          entityType,
          reactionType,
        },
      });

      // Increment likesCount if applicable
      if (entityType === ReactableType.ARTICLE) {
        updatedEntity = await prisma.article.update({
          where: { id: entityId },
          data: { likesCount: { increment: 1 } },
        });
      } else if (entityType === ReactableType.GROUP_POST) {
        updatedEntity = await prisma.groupPost.update({
          where: { id: entityId },
          data: { likesCount: { increment: 1 } },
        });
      }

      // Create notification for the entity owner
      let entityOwnerId: string | undefined;
      if (entityType === ReactableType.ARTICLE) {
        const article = await prisma.article.findUnique({ where: { id: entityId } });
        entityOwnerId = article?.authorId;
      } else if (entityType === ReactableType.GROUP_POST) {
        const post = await prisma.groupPost.findUnique({ where: { id: entityId } });
        entityOwnerId = post?.authorId;
      } else if (entityType === ReactableType.COMMENT) {
        const comment = await prisma.comment.findUnique({ where: { id: entityId } });
        entityOwnerId = comment?.authorId;
      }

      if (entityOwnerId && entityOwnerId !== userId) {
        await NotificationManager.createNotification(
          entityOwnerId,
          NotificationType.NEW_REACTION,
          newReaction.id,
          NotificationEntityType.REACTION,
          `Someone reacted to your ${entityType.toLowerCase()} with a ${reactionType.toLowerCase()} reaction`
        );
      }

      // Publish to Redis for real-time updates
      await redisPublisher.publish(
        `reactions:${entityType}:${entityId}`,
        JSON.stringify({ type: 'REACTION_ADDED', reaction: newReaction, updatedEntity })
      );

      return { reaction: newReaction, updatedEntity };
    }
  }
}