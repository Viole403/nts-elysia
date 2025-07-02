import { prisma } from '../../lib/prisma';
import { CommentableType, VoteType, NotificationType, NotificationEntityType } from '@prisma/client';
import { NotificationManager } from '../../utils/notification.manager';
import { redis } from '../../plugins/redis.plugin';

export class CommentService {
  static async create(data: { content: string; authorId: string; entityId: string; entityType: CommentableType; parentId?: string }) {
    const { content, authorId, entityId, entityType, parentId } = data;
    const comment = await prisma.comment.create({
      data: {
        content,
        authorId,
        entityId,
        entityType,
        parentId,
      },
    });

    // Create notification for the entity owner
    let entityOwnerId: string | undefined;
    if (entityType === CommentableType.ARTICLE) {
      const article = await prisma.article.findUnique({ where: { id: entityId } });
      entityOwnerId = article?.authorId;
    } else if (entityType === CommentableType.GROUP_POST) {
      const post = await prisma.groupPost.findUnique({ where: { id: entityId } });
      entityOwnerId = post?.authorId;
    }

    if (entityOwnerId && entityOwnerId !== authorId) {
      await NotificationManager.createNotification(
        entityOwnerId,
        NotificationType.NEW_COMMENT,
        comment.id,
        NotificationEntityType.COMMENT,
        `New comment on your ${entityType.toLowerCase()}`
      );
    }

    // If it's a reply, notify the parent comment's author
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({ where: { id: parentId } });
      if (parentComment && parentComment.authorId !== authorId) {
        await NotificationManager.createNotification(
          parentComment.authorId,
          NotificationType.NEW_COMMENT,
          comment.id,
          NotificationEntityType.COMMENT,
          `New reply to your comment`
        );
      }
    }

    // Publish to Redis for real-time updates
    await redis.publish(
      `comments:${entityType}:${entityId}`,
      JSON.stringify({ type: 'NEW_COMMENT', comment })
    );

    return comment;
  }

  static async findAll(entityId: string, entityType: CommentableType, page: number = 1, limit: number = 10, sortBy: string = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc') {
    const skip = (page - 1) * limit;
    const comments = await prisma.comment.findMany({
      where: {
        entityId,
        entityType,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        replies: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
      skip,
      take: limit,
    });
    const total = await prisma.comment.count({
      where: {
        entityId,
        entityType,
      },
    });
    return { comments, total, page, limit };
  }

  static async findOne(id: string) {
    return prisma.comment.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        replies: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  static async update(id: string, data: { content: string }) {
    const updatedComment = await prisma.comment.update({
      where: { id },
      data: {
        content: data.content,
      },
    });

    // Publish to Redis for real-time updates
    await redis.publish(
      `comments:${updatedComment.entityType}:${updatedComment.entityId}`,
      JSON.stringify({ type: 'UPDATED_COMMENT', comment: updatedComment })
    );

    return updatedComment;
  }

  static async delete(id: string) {
    const deletedComment = await prisma.comment.delete({
      where: { id },
    });

    // Publish to Redis for real-time updates
    await redis.publish(
      `comments:${deletedComment.entityType}:${deletedComment.entityId}`,
      JSON.stringify({ type: 'DELETED_COMMENT', commentId: deletedComment.id })
    );

    return deletedComment;
  }

  static async vote(commentId: string, userId: string, voteType: VoteType) {
    const existingVote = await prisma.commentVote.findUnique({
      where: {
        commentId_userId: {
          commentId,
          userId,
        },
      },
    });

    let updatedComment;

    if (existingVote) {
      if (existingVote.voteType === voteType) {
        // User is trying to vote the same way again, so remove the vote
        await prisma.commentVote.delete({
          where: {
            id: existingVote.id,
          },
        });
        updatedComment = await prisma.comment.update({
          where: { id: commentId },
          data: {
            upvotesCount: { decrement: voteType === VoteType.UPVOTE ? 1 : 0 },
            downvotesCount: { decrement: voteType === VoteType.DOWNVOTE ? 1 : 0 },
          },
        });
      } else {
        // User is changing their vote
        await prisma.commentVote.update({
          where: { id: existingVote.id },
          data: {
            voteType,
          },
        });
        updatedComment = await prisma.comment.update({
          where: { id: commentId },
          data: {
            upvotesCount: {
              increment: voteType === VoteType.UPVOTE ? 1 : 0,
              decrement: voteType === VoteType.DOWNVOTE ? 0 : 1,
            },
            downvotesCount: {
              increment: voteType === VoteType.DOWNVOTE ? 1 : 0,
              decrement: voteType === VoteType.UPVOTE ? 0 : 1,
            },
          },
        });
      }
    } else {
      // New vote
      await prisma.commentVote.create({
        data: {
          commentId,
          userId,
          voteType,
        },
      });
      updatedComment = await prisma.comment.update({
        where: { id: commentId },
        data: {
          upvotesCount: { increment: voteType === VoteType.UPVOTE ? 1 : 0 },
          downvotesCount: { increment: voteType === VoteType.DOWNVOTE ? 1 : 0 },
        },
      });
    }

    // Create notification for the comment author
    const commentAuthor = await prisma.comment.findUnique({ where: { id: commentId } });
    if (commentAuthor && commentAuthor.authorId !== userId) {
      await NotificationManager.createNotification(
        commentAuthor.authorId,
        NotificationType.NEW_REACTION,
        commentId,
        NotificationEntityType.COMMENT,
        `Your comment received a ${voteType.toLowerCase()}`
      );
    }

    // Publish to Redis for real-time vote updates
    await redis.publish(
      `comments:${commentId}:votes`,
      JSON.stringify({ type: 'VOTE_UPDATED', commentId, voteType, updatedComment })
    );

    return updatedComment;
  }
}