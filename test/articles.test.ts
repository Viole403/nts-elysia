import { describe, expect, it, beforeEach } from 'bun:test';
import app from '../src/index';
import { prisma } from '../src/lib/prisma';
import { ArticleStatus, UserRole } from '@prisma/client';
import { redisPublisher } from '../src/plugins/redis.plugin';

// Mock Prisma and RedisPublisher
const mockPrisma = {
  article: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  articleView: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  articleSubscription: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
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

// Replace actual imports with mocks
// @ts-ignore
prisma = mockPrisma;
// @ts-ignore
redisPublisher = mockRedisPublisher;

const mockAdminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFkbWluVXNlcklkIiwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxNzAwMDE3MjAwfQ.dummy_admin_token';
const mockInstructorToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Imluc3RydWN0b3JJZDEyMyIsImVtYWlsIjoiaW5zdHJ1Y3RvckBleGFtcGxlLmNvbSIsInJvbGUiOiJJTlNUUlVDVE9SIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMTcyMDB9.dummy_instructor_token';
const mockUserToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXJJZDEyMyIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsInJvbGUiOiJVU0VSIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMTcyMDB9.dummy_user_token';

describe('Articles Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /articles', () => {
    it('should create a new article successfully', async () => {
      const newArticle = {
        title: 'Test Article',
        content: 'This is the content of the test article.',
        authorId: 'instructorId123',
      };

      mockPrisma.article.create.mockResolvedValue({
        id: 'article1',
        slug: 'test-article',
        ...newArticle,
        status: ArticleStatus.DRAFT,
      });

      const response = await app.handle(
        new Request('http://localhost/articles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockInstructorToken}`,
          },
          body: JSON.stringify(newArticle),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.slug).toBe('test-article');
      expect(mockPrisma.article.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: newArticle.title,
          content: newArticle.content,
          authorId: newArticle.authorId,
          slug: 'test-article',
        }),
      });
    });

    it('should return 401 if not authenticated', async () => {
      const newArticle = {
        title: 'Test Article',
        content: 'This is the content of the test article.',
        authorId: 'instructorId123',
      };

      const response = await app.handle(
        new Request('http://localhost/articles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newArticle),
        })
      );

      expect(response.status).toBe(401);
    });

    it('should return 403 if user does not have INSTRUCTOR or ADMIN role', async () => {
      const newArticle = {
        title: 'Test Article',
        content: 'This is the content of the test article.',
        authorId: 'userId123',
      };

      const response = await app.handle(
        new Request('http://localhost/articles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockUserToken}`,
          },
          body: JSON.stringify(newArticle),
        })
      );

      expect(response.status).toBe(403);
    });
  });

  describe('GET /articles', () => {
    it('should return a list of articles', async () => {
      const mockArticles = [
        { id: 'a1', title: 'Article 1', slug: 'article-1', authorId: 'auth1', status: ArticleStatus.PUBLISHED },
        { id: 'a2', title: 'Article 2', slug: 'article-2', authorId: 'auth2', status: ArticleStatus.DRAFT },
      ];
      mockPrisma.article.findMany.mockResolvedValue(mockArticles);
      mockPrisma.article.count.mockResolvedValue(2);

      const response = await app.handle(
        new Request('http://localhost/articles', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.articles).toEqual(mockArticles);
      expect(body.total).toBe(2);
    });
  });

  describe('GET /articles/:slug', () => {
    it('should return a single article and increment view count', async () => {
      const mockArticle = { id: 'a1', title: 'Article 1', slug: 'article-1', authorId: 'auth1', viewsCount: 0 };
      mockPrisma.article.findUnique.mockResolvedValue(mockArticle);
      mockPrisma.articleView.findFirst.mockResolvedValue(null);
      mockPrisma.article.update.mockResolvedValue({ ...mockArticle, viewsCount: 1 });
      mockRedisPublisher.publish.mockResolvedValue(1);

      const response = await app.handle(
        new Request('http://localhost/articles/article-1', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.slug).toBe('article-1');
      expect(mockPrisma.article.findUnique).toHaveBeenCalledWith({ where: { slug: 'article-1' } });
      expect(mockPrisma.article.update).toHaveBeenCalledWith({
        where: { slug: 'article-1' },
        data: { viewsCount: { increment: 1 } },
      });
      expect(mockRedisPublisher.publish).toHaveBeenCalled();
    });

    it('should return 404 if article not found', async () => {
      mockPrisma.article.findUnique.mockResolvedValue(null);

      const response = await app.handle(
        new Request('http://localhost/articles/non-existent-article', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /articles/:slug', () => {
    it('should update an article successfully by author', async () => {
      const existingArticle = { id: 'a1', title: 'Old Title', slug: 'old-title', content: 'Old content', authorId: 'instructorId123', status: ArticleStatus.DRAFT };
      const updatedData = { title: 'New Title', status: ArticleStatus.PUBLISHED };

      mockPrisma.article.findUnique.mockResolvedValue(existingArticle);
      mockPrisma.article.update.mockResolvedValue({ ...existingArticle, ...updatedData });
      mockPrisma.articleSubscription.findMany.mockResolvedValue([]);
      mockRedisPublisher.publish.mockResolvedValue(1);

      const response = await app.handle(
        new Request('http://localhost/articles/old-title', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockInstructorToken}`,
          },
          body: JSON.stringify(updatedData),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.title).toBe('New Title');
      expect(body.status).toBe(ArticleStatus.PUBLISHED);
      expect(mockPrisma.article.update).toHaveBeenCalledWith({
        where: { slug: 'old-title' },
        data: updatedData,
      });
      expect(mockRedisPublisher.publish).toHaveBeenCalled();
    });

    it('should return 403 if user is not author or admin', async () => {
      const existingArticle = { id: 'a1', title: 'Old Title', slug: 'old-title', content: 'Old content', authorId: 'otherAuthorId', status: ArticleStatus.DRAFT };
      const updatedData = { title: 'New Title' };

      mockPrisma.article.findUnique.mockResolvedValue(existingArticle);

      const response = await app.handle(
        new Request('http://localhost/articles/old-title', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockUserToken}`,
          },
          body: JSON.stringify(updatedData),
        })
      );

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /articles/:slug', () => {
    it('should delete an article successfully by author', async () => {
      const existingArticle = { id: 'a1', title: 'Article to Delete', slug: 'article-to-delete', authorId: 'instructorId123' };

      mockPrisma.article.findUnique.mockResolvedValue(existingArticle);
      mockPrisma.article.delete.mockResolvedValue(existingArticle);

      const response = await app.handle(
        new Request('http://localhost/articles/article-to-delete', {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${mockInstructorToken}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.slug).toBe('article-to-delete');
      expect(mockPrisma.article.delete).toHaveBeenCalledWith({ where: { slug: 'article-to-delete' } });
    });

    it('should return 403 if user is not author or admin', async () => {
      const existingArticle = { id: 'a1', title: 'Article to Delete', slug: 'article-to-delete', authorId: 'otherAuthorId' };

      mockPrisma.article.findUnique.mockResolvedValue(existingArticle);

      const response = await app.handle(
        new Request('http://localhost/articles/article-to-delete', {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${mockUserToken}`,
          },
        })
      );

      expect(response.status).toBe(403);
    });
  });

  describe('POST /articles/:slug/subscribe', () => {
    it('should subscribe to an article successfully', async () => {
      const mockArticle = { id: 'a1', title: 'Article 1', slug: 'article-1', authorId: 'auth1' };
      mockPrisma.article.findUnique.mockResolvedValue(mockArticle);
      mockPrisma.articleSubscription.findUnique.mockResolvedValue(null);
      mockPrisma.articleSubscription.create.mockResolvedValue({ articleId: 'a1', userId: 'userId123' });
      mockRedisPublisher.publish.mockResolvedValue(1);

      const response = await app.handle(
        new Request('http://localhost/articles/article-1/subscribe', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mockUserToken}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.articleId).toBe('a1');
      expect(body.userId).toBe('userId123');
      expect(mockPrisma.articleSubscription.create).toHaveBeenCalledWith({
        data: { articleId: 'a1', userId: 'userId123' },
      });
      expect(mockRedisPublisher.publish).toHaveBeenCalled();
    });

    it('should return 409 if already subscribed', async () => {
      const mockArticle = { id: 'a1', title: 'Article 1', slug: 'article-1', authorId: 'auth1' };
      mockPrisma.article.findUnique.mockResolvedValue(mockArticle);
      mockPrisma.articleSubscription.findUnique.mockResolvedValue({ articleId: 'a1', userId: 'userId123' });

      const response = await app.handle(
        new Request('http://localhost/articles/article-1/subscribe', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mockUserToken}`,
          },
        })
      );

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.message).toBe('Already subscribed to this article.');
    });
  });

  describe('DELETE /articles/:slug/subscribe', () => {
    it('should unsubscribe from an article successfully', async () => {
      const mockArticle = { id: 'a1', title: 'Article 1', slug: 'article-1', authorId: 'auth1' };
      mockPrisma.article.findUnique.mockResolvedValue(mockArticle);
      mockPrisma.articleSubscription.delete.mockResolvedValue({ articleId: 'a1', userId: 'userId123' });
      mockRedisPublisher.publish.mockResolvedValue(1);

      const response = await app.handle(
        new Request('http://localhost/articles/article-1/subscribe', {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${mockUserToken}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.articleId).toBe('a1');
      expect(body.userId).toBe('userId123');
      expect(mockPrisma.articleSubscription.delete).toHaveBeenCalledWith({
        where: {
          articleId_userId: {
            articleId: 'a1',
            userId: 'userId123',
          },
        },
      });
      expect(mockRedisPublisher.publish).toHaveBeenCalled();
    });

    it('should return 404 if article not found', async () => {
      mockPrisma.article.findUnique.mockResolvedValue(null);

      const response = await app.handle(
        new Request('http://localhost/articles/non-existent-article/subscribe', {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${mockUserToken}`,
          },
        })
      );

      expect(response.status).toBe(404);
    });
  });
});