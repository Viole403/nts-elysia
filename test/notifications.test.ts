import { describe, expect, it, beforeEach } from 'bun:test';
import app from '../src/index';
import { prisma } from '../src/lib/prisma';
import { UserRole } from '@prisma/client';
import { redisSubscriber } from '../src/plugins/redis.plugin';

// Mock Prisma and RedisSubscriber
const mockPrisma = {
  notification: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
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

// Replace actual imports with mocks
// @ts-ignore
prisma = mockPrisma;
// @ts-ignore
redisSubscriber = mockRedisSubscriber;

const mockUserToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXJJZDEyMyIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsInJvbGUiOiJVU0VSIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMTcyMDB9.dummy_user_token';

describe('Notifications Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /notifications', () => {
    it('should return a list of notifications for the authenticated user', async () => {
      const mockNotifications = [
        { id: 'n1', userId: 'userId123', message: 'Notif 1', isRead: false },
        { id: 'n2', userId: 'userId123', message: 'Notif 2', isRead: true },
      ];
      mockPrisma.notification.findMany.mockResolvedValue(mockNotifications);

      const response = await app.handle(
        new Request('http://localhost/notifications', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${mockUserToken}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual(mockNotifications);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'userId123' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return 401 if not authenticated', async () => {
      const response = await app.handle(
        new Request('http://localhost/notifications', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(401);
    });

    it('should filter notifications by isRead status', async () => {
      const mockNotifications = [
        { id: 'n1', userId: 'userId123', message: 'Notif 1', isRead: false },
      ];
      mockPrisma.notification.findMany.mockResolvedValue(mockNotifications);

      const response = await app.handle(
        new Request('http://localhost/notifications?isRead=false', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${mockUserToken}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual(mockNotifications);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'userId123', isRead: false },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('PUT /notifications/:id/read', () => {
    it('should mark a notification as read successfully', async () => {
      const notificationId = 'n1';
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 1 });

      const response = await app.handle(
        new Request(`http://localhost/notifications/${notificationId}/read`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${mockUserToken}`,
            },
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.count).toBe(1);
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: notificationId, userId: 'userId123' },
        data: { isRead: true },
      });
    });

    it('should return 401 if not authenticated', async () => {
      const notificationId = 'n1';
      const response = await app.handle(
        new Request(`http://localhost/notifications/${notificationId}/read`,
          {
            method: 'PUT',
          })
      );

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /notifications/read-all', () => {
    it('should mark all notifications as read successfully', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 2 });

      const response = await app.handle(
        new Request('http://localhost/notifications/read-all', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${mockUserToken}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.count).toBe(2);
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'userId123', isRead: false },
        data: { isRead: true },
      });
    });

    it('should return 401 if not authenticated', async () => {
      const response = await app.handle(
        new Request('http://localhost/notifications/read-all', {
          method: 'PUT',
        })
      );

      expect(response.status).toBe(401);
    });
  });

  describe('GET /notifications/stream', () => {
    it('should establish an SSE connection', async () => {
      // This test primarily checks if the endpoint can be hit and doesn't throw errors
      // Full SSE testing would require a more complex setup to consume the stream
      const response = await app.handle(
        new Request('http://localhost/notifications/stream', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${mockUserToken}`,
          },
        })
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
      expect(response.headers.get('Connection')).toBe('keep-alive');

      // Since we are mocking redisSubscriber, we can't truly test the stream content here
      // but we can verify that subscribe was called.
      expect(mockRedisSubscriber.subscribe).toHaveBeenCalledWith(
        'user:userId123:notifications',
        expect.any(Function)
      );
    });

    it('should return 401 if not authenticated for stream', async () => {
      const response = await app.handle(
        new Request('http://localhost/notifications/stream', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(401);
    });
  });
});