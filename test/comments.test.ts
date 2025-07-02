import { describe, expect, it, beforeEach } from 'bun:test';
import app from '../src/index';
import { prisma } from '../src/lib/prisma';
import { CommentableType, NotificationEntityType, NotificationType, UserRole, VoteType } from '@prisma/client';
import { redisPublisher, redisSubscriber } from '../src/plugins/redis.plugin';

// Mock Prisma and Redis
const mockPrisma = {
  comment: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  commentVote: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  article: {
    findUnique: jest.fn(),
  },
  groupPost: {
    findUnique: jest.fn(),
  },
};

const mockRedisPublisher = {
  publish: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  get: jest.fn(),
  keys: jest.fn(),
  ttl: jest.fn(),
};

const mockRedisSubscriber = {
  subscribe: jest.fn((channel, cb) => {
    // Simulate immediate callback for subscription success
    cb(null, 1);
  }),
  on: jest.fn(),
  unsubscribe: jest.fn(),
  off: jest.fn(),
};

// Mock NotificationManager (since it's used in service)
const mockNotificationManager = {
  createNotification: jest.fn(),
};

// Replace actual imports with mocks
// @ts-ignore
prisma = mockPrisma;
// @ts-ignore
redisPublisher = mockRedisPublisher;
// @ts-ignore
redisSubscriber = mockRedisSubscriber;
// @ts-ignore
// Mocking NotificationManager directly in the test file for simplicity
// In a real app, you might want to mock the entire module or use a DI container
const NotificationManager = mockNotificationManager;

const mockUserToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXJJZDEyMyIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsInJvbGUiOiJVU0VSIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMTcyMDB9.dummy_user_token';
const mockAdminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFkbWluVXNlcklkIiwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxNzAwMDE3MjAwfQ.dummy_admin_token';

describe('Comments Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /comments/:entityType/:entityId', () => {
    it('should create a new comment successfully', async () => {
      const newComment = {
        content: 'This is a new comment.',
      };
      const entityId = 'article123';
      const entityType = CommentableType.ARTICLE;

      mockPrisma.comment.create.mockResolvedValue({
        id: 'comment1',
        authorId: 'userId123',
        entityId,
        entityType,
        ...newComment,
      });
      mockPrisma.article.findUnique.mockResolvedValue({ id: entityId, authorId: 'articleAuthor123' });
      mockRedisPublisher.publish.mockResolvedValue(1);
      mockNotificationManager.createNotification.mockResolvedValue({});

      const response = await app.handle(
        new Request(`http://localhost/comments/${entityType}/${entityId}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mockUserToken}`,
            },
            body: JSON.stringify(newComment),
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.content).toBe(newComment.content);
      expect(mockPrisma.comment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          content: newComment.content,
          authorId: 'userId123',
          entityId,
          entityType,
        }),
      });
      expect(mockRedisPublisher.publish).toHaveBeenCalledWith(
        `comments:${entityType}:${entityId}`,
        JSON.stringify({ type: 'NEW_COMMENT', comment: expect.any(Object) })
      );
      expect(mockNotificationManager.createNotification).toHaveBeenCalledWith(
        'articleAuthor123',
        NotificationType.NEW_COMMENT,
        'comment1',
        NotificationEntityType.COMMENT,
        `New comment on your ${entityType.toLowerCase()}`
      );
    });

    it('should return 401 if not authenticated', async () => {
      const newComment = {
        content: 'This is a new comment.',
      };
      const entityId = 'article123';
      const entityType = CommentableType.ARTICLE;

      const response = await app.handle(
        new Request(`http://localhost/comments/${entityType}/${entityId}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newComment),
          })
      );

      expect(response.status).toBe(401);
    });
  });

  describe('GET /comments/:entityType/:entityId', () => {
    it('should return a list of comments', async () => {
      const entityId = 'article123';
      const entityType = CommentableType.ARTICLE;
      const mockComments = [
        { id: 'c1', content: 'Comment 1', author: { username: 'user1' } },
        { id: 'c2', content: 'Comment 2', author: { username: 'user2' } },
      ];
      mockPrisma.comment.findMany.mockResolvedValue(mockComments);
      mockPrisma.comment.count.mockResolvedValue(2);

      const response = await app.handle(
        new Request(`http://localhost/comments/${entityType}/${entityId}`,
          {
            method: 'GET',
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.comments).toEqual(mockComments);
      expect(body.total).toBe(2);
      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { entityId, entityType },
      }));
    });
  });

  describe('PUT /comments/:id', () => {
    it('should update a comment successfully by author', async () => {
      const commentId = 'comment1';
      const updatedContent = { content: 'Updated comment content.' };
      const existingComment = { id: commentId, authorId: 'userId123', entityId: 'art1', entityType: CommentableType.ARTICLE };

      mockPrisma.comment.findUnique.mockResolvedValue(existingComment);
      mockPrisma.comment.update.mockResolvedValue({ ...existingComment, ...updatedContent });
      mockRedisPublisher.publish.mockResolvedValue(1);

      const response = await app.handle(
        new Request(`http://localhost/comments/${commentId}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mockUserToken}`,
            },
            body: JSON.stringify(updatedContent),
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.content).toBe(updatedContent.content);
      expect(mockPrisma.comment.update).toHaveBeenCalledWith({
        where: { id: commentId },
        data: updatedContent,
      });
      expect(mockRedisPublisher.publish).toHaveBeenCalledWith(
        `comments:${existingComment.entityType}:${existingComment.entityId}`,
        JSON.stringify({ type: 'UPDATED_COMMENT', comment: expect.any(Object) })
      );
    });

    it('should return 403 if user is not author or admin', async () => {
      const commentId = 'comment1';
      const updatedContent = { content: 'Updated comment content.' };
      const existingComment = { id: commentId, authorId: 'otherUser', entityId: 'art1', entityType: CommentableType.ARTICLE };

      mockPrisma.comment.findUnique.mockResolvedValue(existingComment);

      const response = await app.handle(
        new Request(`http://localhost/comments/${commentId}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mockUserToken}`,
            },
            body: JSON.stringify(updatedContent),
          })
      );

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /comments/:id', () => {
    it('should delete a comment successfully by author', async () => {
      const commentId = 'comment1';
      const existingComment = { id: commentId, authorId: 'userId123', entityId: 'art1', entityType: CommentableType.ARTICLE };

      mockPrisma.comment.findUnique.mockResolvedValue(existingComment);
      mockPrisma.comment.delete.mockResolvedValue(existingComment);
      mockRedisPublisher.publish.mockResolvedValue(1);

      const response = await app.handle(
        new Request(`http://localhost/comments/${commentId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${mockUserToken}`,
            },
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe(commentId);
      expect(mockPrisma.comment.delete).toHaveBeenCalledWith({ where: { id: commentId } });
      expect(mockRedisPublisher.publish).toHaveBeenCalledWith(
        `comments:${existingComment.entityType}:${existingComment.entityId}`,
        JSON.stringify({ type: 'DELETED_COMMENT', commentId: existingComment.id })
      );
    });

    it('should return 403 if user is not author or admin', async () => {
      const commentId = 'comment1';
      const existingComment = { id: commentId, authorId: 'otherUser', entityId: 'art1', entityType: CommentableType.ARTICLE };

      mockPrisma.comment.findUnique.mockResolvedValue(existingComment);

      const response = await app.handle(
        new Request(`http://localhost/comments/${commentId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${mockUserToken}`,
            },
          })
      );

      expect(response.status).toBe(403);
    });
  });

  describe('POST /comments/:id/vote', () => {
    it('should upvote a comment successfully', async () => {
      const commentId = 'comment1';
      const existingComment = { id: commentId, authorId: 'commentAuthor', upvotesCount: 0, downvotesCount: 0 };

      mockPrisma.commentVote.findUnique.mockResolvedValue(null);
      mockPrisma.commentVote.create.mockResolvedValue({});
      mockPrisma.comment.update.mockResolvedValue({ ...existingComment, upvotesCount: 1 });
      mockPrisma.comment.findUnique.mockResolvedValue(existingComment);
      mockRedisPublisher.publish.mockResolvedValue(1);
      mockNotificationManager.createNotification.mockResolvedValue({});

      const response = await app.handle(
        new Request(`http://localhost/comments/${commentId}/vote`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mockUserToken}`,
            },
            body: JSON.stringify({ voteType: VoteType.UPVOTE }),
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.upvotesCount).toBe(1);
      expect(mockPrisma.commentVote.create).toHaveBeenCalledWith({
        data: { commentId, userId: 'userId123', voteType: VoteType.UPVOTE },
      });
      expect(mockRedisPublisher.publish).toHaveBeenCalledWith(
        `comments:${commentId}:votes`,
        JSON.stringify({ type: 'VOTE_UPDATED', commentId, voteType: VoteType.UPVOTE, updatedComment: expect.any(Object) })
      );
      expect(mockNotificationManager.createNotification).toHaveBeenCalledWith(
        'commentAuthor',
        NotificationType.NEW_REACTION,
        commentId,
        NotificationEntityType.COMMENT,
        `Your comment received a ${VoteType.UPVOTE.toLowerCase()}`
      );
    });

    it('should change vote from upvote to downvote', async () => {
      const commentId = 'comment1';
      const existingComment = { id: commentId, authorId: 'commentAuthor', upvotesCount: 1, downvotesCount: 0 };

      mockPrisma.commentVote.findUnique.mockResolvedValue({ id: 'vote1', commentId, userId: 'userId123', voteType: VoteType.UPVOTE });
      mockPrisma.commentVote.update.mockResolvedValue({});
      mockPrisma.comment.update.mockResolvedValue({ ...existingComment, upvotesCount: 0, downvotesCount: 1 });
      mockPrisma.comment.findUnique.mockResolvedValue(existingComment);
      mockRedisPublisher.publish.mockResolvedValue(1);
      mockNotificationManager.createNotification.mockResolvedValue({});

      const response = await app.handle(
        new Request(`http://localhost/comments/${commentId}/vote`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mockUserToken}`,
            },
            body: JSON.stringify({ voteType: VoteType.DOWNVOTE }),
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.upvotesCount).toBe(0);
      expect(body.downvotesCount).toBe(1);
      expect(mockPrisma.commentVote.update).toHaveBeenCalledWith({
        where: { id: 'vote1' },
        data: { voteType: VoteType.DOWNVOTE },
      });
      expect(mockRedisPublisher.publish).toHaveBeenCalled();
      expect(mockNotificationManager.createNotification).toHaveBeenCalled();
    });

    it('should remove vote if voting same type again', async () => {
      const commentId = 'comment1';
      const existingComment = { id: commentId, authorId: 'commentAuthor', upvotesCount: 1, downvotesCount: 0 };

      mockPrisma.commentVote.findUnique.mockResolvedValue({ id: 'vote1', commentId, userId: 'userId123', voteType: VoteType.UPVOTE });
      mockPrisma.commentVote.delete.mockResolvedValue({});
      mockPrisma.comment.update.mockResolvedValue({ ...existingComment, upvotesCount: 0 });
      mockPrisma.comment.findUnique.mockResolvedValue(existingComment);
      mockRedisPublisher.publish.mockResolvedValue(1);
      mockNotificationManager.createNotification.mockResolvedValue({});

      const response = await app.handle(
        new Request(`http://localhost/comments/${commentId}/vote`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mockUserToken}`,
            },
            body: JSON.stringify({ voteType: VoteType.UPVOTE }),
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.upvotesCount).toBe(0);
      expect(mockPrisma.commentVote.delete).toHaveBeenCalledWith({ where: { id: 'vote1' } });
      expect(mockRedisPublisher.publish).toHaveBeenCalled();
      expect(mockNotificationManager.createNotification).toHaveBeenCalled();
    });
  });
});