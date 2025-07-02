import { describe, expect, it, beforeEach } from 'bun:test';
import { prisma } from '../src/lib/prisma';
import { redis } from '../src/plugins/redis.plugin';
import { NotificationManager } from '../src/utils/notification.manager';
import { CronService } from '../src/modules/cron/service';
import { PaymentEntityType, PaymentStatus } from '@prisma/client';

// Mock Prisma, RedisPublisher, and NotificationManager
const mockPrisma = {
  healthCheckLog: {
    create: jest.fn(),
  },
  dataMigrationLog: {
    create: jest.fn(),
  },
  payment: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  shopItem: {
    update: jest.fn(),
  },
};

const mockRedis = {
  keys: jest.fn(),
  ttl: jest.fn(),
  del: jest.fn(),
};

const mockNotificationManager = {
  createNotification: jest.fn(),
};

// Replace actual imports with mocks
// @ts-ignore
prisma = mockPrisma;
// @ts-ignore
redis = mockRedis;
// @ts-ignore
NotificationManager = mockNotificationManager;

describe('Cron Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('healthCheck', () => {
    it('should log a successful health check', async () => {
      mockPrisma.healthCheckLog.create.mockResolvedValue({});

      await CronService.healthCheck();

      expect(mockPrisma.healthCheckLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'OK',
          responseTimeMs: expect.any(Number),
        }),
      });
    });
  });

  describe('dataMigration', () => {
    it('should log a successful data migration', async () => {
      mockPrisma.dataMigrationLog.create.mockResolvedValue({});

      await CronService.dataMigration();

      expect(mockPrisma.dataMigrationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          migrationName: expect.any(String),
          status: 'SUCCESS',
        }),
      });
    });

    it('should log a failed data migration', async () => {
      const errorMessage = 'Migration failed';
      mockPrisma.dataMigrationLog.create.mockRejectedValue(new Error(errorMessage));

      // Mock console.error to prevent test runner from showing the error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await CronService.dataMigration();

      expect(mockPrisma.dataMigrationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          migrationName: expect.any(String),
          status: 'FAILED',
          logs: expect.any(String),
        }),
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith('Data migration failed', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });
  });

  describe('checkExpiredPayments', () => {
    it('should mark expired pending payments as EXPIRED and release reserved stock', async () => {
      const expiredPaymentId = 'expiredPayment1';
      const shopItemId = 'shopItem1';
      const quantity = 2;

      mockRedis.keys.mockResolvedValue([`pending_payment:${expiredPaymentId}`]);
      mockRedis.ttl.mockResolvedValue(-2); // Simulate expired key
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: expiredPaymentId,
        status: PaymentStatus.PENDING,
        entityType: PaymentEntityType.SHOP_ITEM,
        entityId: shopItemId,
        quantity,
        userId: 'user123',
      });
      mockPrisma.payment.update.mockResolvedValue({});
      mockPrisma.shopItem.update.mockResolvedValue({});
      mockNotificationManager.createNotification.mockResolvedValue({});

      await CronService.checkExpiredPayments();

      expect(mockRedis.keys).toHaveBeenCalledWith('pending_payment:*');
      expect(mockRedis.ttl).toHaveBeenCalledWith(`pending_payment:${expiredPaymentId}`);
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: expiredPaymentId },
        data: { status: PaymentStatus.EXPIRED },
      });
      expect(mockPrisma.shopItem.update).toHaveBeenCalledWith({
        where: { id: shopItemId },
        data: { reservedStock: { decrement: quantity } },
      });
      expect(mockNotificationManager.createNotification).toHaveBeenCalledWith(
        'user123',
        expect.any(String),
        expiredPaymentId,
        expect.any(String),
        expect.any(String)
      );
      expect(console.log).toHaveBeenCalledWith(`Payment ${expiredPaymentId} marked as EXPIRED.`);
    });

    it('should not mark payments as EXPIRED if not pending', async () => {
      const nonPendingPaymentId = 'nonPendingPayment1';

      mockRedisPublisher.keys.mockResolvedValue([`pending_payment:${nonPendingPaymentId}`]);
      mockRedis.ttl.mockResolvedValue(-2); // Simulate expired key
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: nonPendingPaymentId,
        status: PaymentStatus.SUCCESS,
        entityType: PaymentEntityType.SHOP_ITEM,
        entityId: 'shopItem1',
        quantity: 1,
      });

      await CronService.checkExpiredPayments();

      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
      expect(mockPrisma.shopItem.update).not.toHaveBeenCalled();
      expect(mockNotificationManager.createNotification).not.toHaveBeenCalled();
    });

    it('should not mark payments as EXPIRED if Redis key has not expired', async () => {
      const pendingPaymentId = 'pendingPayment1';

      mockRedisPublisher.keys.mockResolvedValue([`pending_payment:${pendingPaymentId}`]);
      mockRedisPublisher.ttl.mockResolvedValue(60); // Simulate key still active
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: pendingPaymentId,
        status: PaymentStatus.PENDING,
        entityType: PaymentEntityType.SHOP_ITEM,
        entityId: 'shopItem1',
        quantity: 1,
      });

      await CronService.checkExpiredPayments();

      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
      expect(mockPrisma.shopItem.update).not.toHaveBeenCalled();
      expect(mockNotificationManager.createNotification).not.toHaveBeenCalled();
    });
  });
});