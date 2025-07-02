import { describe, expect, it, beforeEach } from 'bun:test';
import app from '../src/index';
import { prisma } from '../src/lib/prisma';
import { NotificationEntityType, NotificationType, ReactableType, ReactionType, UserRole } from '@prisma/client';
import { redisPublisher, redisSubscriber } from '../src/plugins/redis.plugin';

// Mock Prisma and Redis
const mockPrisma = {
  reaction: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  article: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  groupPost: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  comment: {
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
NotificationManager = mockNotificationManager;

const mockUserToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXJJZDEyMyIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsInJvbGUiOiJVU0VSIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMTcyMDB9.dummy_user_token';

describe('Reactions Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /reactions/:entityType/:entityId', () => {
    it('should create a new reaction successfully', async () => {
      const entityId = 'article123';
      const entityType = ReactableType.ARTICLE;
      const reactionType = ReactionType.LIKE;

      mockPrisma.reaction.findUnique.mockResolvedValue(null);
      mockPrisma.reaction.create.mockResolvedValue({
        id: 'reaction1',
        userId: 'userId123',
        entityId,
        entityType,
        reactionType,
      });
      mockPrisma.article.findUnique.mockResolvedValue({ id: entityId, authorId: 'articleAuthor123', likesCount: 0 });
      mockPrisma.article.update.mockResolvedValue({ likesCount: 1 });
      mockRedisPublisher.publish.mockResolvedValue(1);
      mockNotificationManager.createNotification.mockResolvedValue({});

      const response = await app.handle(
        new Request(`http://localhost/reactions/${entityType}/${entityId}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mockUserToken}`,
            },
            body: JSON.stringify({ reactionType }),
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.reaction).toBeDefined();
      expect(body.updatedEntity).toBeDefined();
      expect(body.updatedEntity.likesCount).toBe(1);
      expect(mockPrisma.reaction.create).toHaveBeenCalledWith({
        data: { userId: 'userId123', entityId, entityType, reactionType },
      });
      expect(mockPrisma.article.update).toHaveBeenCalledWith({
        where: { id: entityId },
        data: { likesCount: { increment: 1 } },
      });
      expect(mockRedisPublisher.publish).toHaveBeenCalledWith(
        `reactions:${entityType}:${entityId}`,
        JSON.stringify({ type: 'REACTION_ADDED', reaction: expect.any(Object), updatedEntity: expect.any(Object) })
      );
      expect(mockNotificationManager.createNotification).toHaveBeenCalledWith(
        'articleAuthor123',
        NotificationType.NEW_REACTION,
        'reaction1',
        NotificationEntityType.REACTION,
        `Someone reacted to your ${entityType.toLowerCase()} with a ${reactionType.toLowerCase()} reaction`
      );
    });

    it('should remove an existing reaction successfully', async () => {
      const entityId = 'article123';
      const entityType = ReactableType.ARTICLE;
      const reactionType = ReactionType.LIKE;

      mockPrisma.reaction.findUnique.mockResolvedValue({
        id: 'reaction1',
        userId: 'userId123',
        entityId,
        entityType,
        reactionType,
      });
      mockPrisma.reaction.delete.mockResolvedValue({});
      mockPrisma.article.update.mockResolvedValue({ likesCount: 0 });
      mockRedisPublisher.publish.mockResolvedValue(1);

      const response = await app.handle(
        new Request(`http://localhost/reactions/${entityType}/${entityId}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mockUserToken}`,
            },
            body: JSON.stringify({ reactionType }),
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.reaction).toBeNull();
      expect(body.updatedEntity).toBeDefined();
      expect(body.updatedEntity.likesCount).toBe(0);
      expect(mockPrisma.reaction.delete).toHaveBeenCalledWith({ where: { id: 'reaction1' } });
      expect(mockPrisma.article.update).toHaveBeenCalledWith({
        where: { id: entityId },
        data: { likesCount: { decrement: 1 } },
      });
      expect(mockRedisPublisher.publish).toHaveBeenCalledWith(
        `reactions:${entityType}:${entityId}`,
        JSON.stringify({ type: 'REACTION_REMOVED', userId: 'userId123', entityId, entityType, reactionType })
      );
    });

    it('should return 401 if not authenticated', async () => {
      const entityId = 'article123';
      const entityType = ReactableType.ARTICLE;
      const reactionType = ReactionType.LIKE;

      const response = await app.handle(
        new Request(`http://localhost/reactions/${entityType}/${entityId}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reactionType }),
          })
      );

      expect(response.status).toBe(401);
    });
  });

  describe('GET /reactions/:entityType/:entityId/stream', () => {
    it('should establish an SSE connection', async () => {
      const entityId = 'article123';
      const entityType = ReactableType.ARTICLE;

      const response = await app.handle(
        new Request(`http://localhost/reactions/${entityType}/${entityId}/stream`,
          {
            method: 'GET',
          })
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
      expect(response.headers.get('Connection')).toBe('keep-alive');

      expect(mockRedisSubscriber.subscribe).toHaveBeenCalledWith(
        `reactions:${entityType}:${entityId}`,
        expect.any(Function)
      );
    });
  });
});