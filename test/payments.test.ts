import { describe, expect, it, beforeEach } from 'bun:test';
import app from '../src/index';
import { prisma } from '../src/lib/prisma';
import { PaymentGateway, PaymentEntityType, PaymentType, PaymentStatus } from '@prisma/client';
import { localPaymentService } from '../src/services/local_payment.service';
import { stripeService } from '../src/services/stripe.service';
import { payPalService } from '../src/services/paypal.service';
import { cryptoPaymentService } from '../src/services/crypto_payment.service';
import { amazonService } from '../src/services/amazon.service';
import { appleService } from '../src/services/apple.service';
import { googleService } from '../src/services/google.service';
import { redis } from '../src/plugins/redis.plugin';
import { NotificationManager } from '../src/utils/notification.manager';

// Mock Prisma and external services
const mockPrisma = {
  payment: {
    create: jest.fn(),
    updateMany: jest.fn(),
    findFirst: jest.fn(),
  },
  shopItem: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  course: {
    findUnique: jest.fn(),
  },
};

const mockLocalPaymentService = {
  provider: 'MIDTRANS',
  createPayment: jest.fn(),
  handleNotification: jest.fn(),
  getTransactionStatus: jest.fn(),
};

const mockStripeService = {
  createCheckoutSession: jest.fn(),
  constructWebhookEvent: jest.fn(),
  retrievePaymentIntent: jest.fn(),
};

const mockPayPalService = {
  createOrder: jest.fn(),
  validateWebhook: jest.fn(),
  getOrder: jest.fn(),
};

const mockCryptoPaymentService = {
  provider: 'COINGATE',
  createPayment: jest.fn(),
  validateWebhook: jest.fn(),
  getPaymentStatus: jest.fn(),
};

const mockAmazonService = {
  createPayment: jest.fn(),
  handleNotification: jest.fn(),
  getTransactionStatus: jest.fn(),
};

const mockAppleService = {
  createPayment: jest.fn(),
  handleNotification: jest.fn(),
  getTransactionStatus: jest.fn(),
};

const mockGoogleService = {
  createPayment: jest.fn(),
  handleNotification: jest.fn(),
  getTransactionStatus: jest.fn(),
};

const mockRedis = {
  publish: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const mockNotificationManager = {
  createNotification: jest.fn(),
};

// Replace actual imports with mocks
// @ts-ignore
prisma = mockPrisma;
// @ts-ignore
localPaymentService = mockLocalPaymentService;
// @ts-ignore
stripeService = mockStripeService;
// @ts-ignore
payPalService = mockPayPalService;
// @ts-ignore
cryptoPaymentService = mockCryptoPaymentService;
// @ts-ignore
amazonService = mockAmazonService;
// @ts-ignore
appleService = mockAppleService;
// @ts-ignore
googleService = mockGoogleService;
// @ts-ignore
redis = mockRedis;
// @ts-ignore
NotificationManager = mockNotificationManager;

const mockUserToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXJJZDEyMyIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsInJvbGUiOiJVU0VSIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMTcyMDB9.dummy_user_token';

describe('Payments Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /payments/create', () => {
    it('should create a local payment successfully for SHOP_ITEM_PURCHASE', async () => {
      const paymentData = {
        entityType: PaymentEntityType.SHOP_ITEM,
        entityId: 'shopItem1',
        quantity: 2,
        paymentGateway: PaymentGateway.LOCAL_PAYMENT,
      };
      const mockShopItem = { id: 'shopItem1', price: 50, stock: 10, reservedStock: 0 };
      const mockLocalPaymentResponse = { token: 'midtrans_token', redirect_url: 'http://midtrans.com/redirect' };

      mockPrisma.shopItem.findUnique.mockResolvedValue(mockShopItem);
      mockLocalPaymentService.createPayment.mockResolvedValue(mockLocalPaymentResponse);
      mockPrisma.payment.create.mockResolvedValue({ id: 'payment1', ...paymentData, amount: 100 });
      mockRedis.set.mockResolvedValue('OK');

      const response = await app.handle(
        new Request('http://localhost/payments/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockUserToken}`,
          },
          body: JSON.stringify(paymentData),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe('payment1');
      expect(body.redirect_url).toBe(mockLocalPaymentResponse.redirect_url);
      expect(mockPrisma.shopItem.findUnique).toHaveBeenCalledWith({ where: { id: 'shopItem1' } });
      expect(mockLocalPaymentService.createPayment).toHaveBeenCalled();
      expect(mockPrisma.payment.create).toHaveBeenCalled();
      expect(mockRedisPublisher.set).toHaveBeenCalled();
    });

    it('should create a Stripe payment successfully for COURSE_PURCHASE', async () => {
      const paymentData = {
        entityType: PaymentEntityType.COURSE,
        entityId: 'course1',
        paymentGateway: PaymentGateway.STRIPE,
      };
      const mockCourse = { id: 'course1', price: 200 };
      const mockStripeSession = { id: 'cs_123', url: 'http://stripe.com/checkout' };

      mockPrisma.course.findUnique.mockResolvedValue(mockCourse);
      mockStripeService.createCheckoutSession.mockResolvedValue(mockStripeSession);
      mockPrisma.payment.create.mockResolvedValue({ id: 'payment2', ...paymentData, amount: 200 });
      mockRedis.set.mockResolvedValue('OK');

      const response = await app.handle(
        new Request('http://localhost/payments/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockUserToken}`,
          },
          body: JSON.stringify(paymentData),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe('payment2');
      expect(body.redirect_url).toBe(mockStripeSession.url);
      expect(mockPrisma.course.findUnique).toHaveBeenCalledWith({ where: { id: 'course1' } });
      expect(mockStripeService.createCheckoutSession).toHaveBeenCalled();
      expect(mockPrisma.payment.create).toHaveBeenCalled();
      expect(mockRedisPublisher.set).toHaveBeenCalled();
    });

    it('should return 401 if not authenticated', async () => {
      const paymentData = {
        entityType: PaymentEntityType.SHOP_ITEM,
        entityId: 'shopItem1',
        quantity: 1,
        paymentGateway: PaymentGateway.LOCAL_PAYMENT,
      };

      const response = await app.handle(
        new Request('http://localhost/payments/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paymentData),
        })
      );

      expect(response.status).toBe(401);
    });
  });

  describe('GET /payments/:paymentGateway/:orderId/status', () => {
    it('should return payment status for local payment', async () => {
      const orderId = 'order123';
      const paymentGateway = PaymentGateway.LOCAL_PAYMENT;
      const mockPayment = { id: 'p1', midtransId: orderId, status: PaymentStatus.PENDING, entityType: PaymentEntityType.SHOP_ITEM, quantity: 1 };

      mockLocalPaymentService.getTransactionStatus.mockResolvedValue({ status: 'COMPLETED' });
      mockPrisma.payment.findFirst.mockResolvedValue(mockPayment);
      mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 });
      mockRedis.del.mockResolvedValue(1);

      const response = await app.handle(
        new Request(`http://localhost/payments/${paymentGateway}/${orderId}/status`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${mockUserToken}`,
            },
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe(PaymentStatus.SUCCESS);
      expect(mockLocalPaymentService.getTransactionStatus).toHaveBeenCalledWith(orderId);
      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: PaymentStatus.SUCCESS } }));
      expect(mockRedis.del).toHaveBeenCalledWith(`pending_payment:${mockPayment.id}`);
    });

    it('should return 401 if not authenticated', async () => {
      const orderId = 'order123';
      const paymentGateway = PaymentGateway.LOCAL_PAYMENT;

      const response = await app.handle(
        new Request(`http://localhost/payments/${paymentGateway}/${orderId}/status`,
          {
            method: 'GET',
          })
      );

      expect(response.status).toBe(401);
    });
  });

  describe('Webhooks', () => {
    it('should handle local payment notification (success) and update stock', async () => {
      const notificationData = { order_id: 'order123', transaction_status: 'settlement', transaction_id: 'midtrans_tx_123' };
      const mockPayment = { id: 'payment1', userId: 'user123', entityType: PaymentEntityType.SHOP_ITEM, entityId: 'shopItem1', quantity: 1 };
      const mockShopItem = { id: 'shopItem1', stock: 5, reservedStock: 1 };

      mockLocalPaymentService.handleNotification.mockResolvedValue(notificationData);
      mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.payment.findFirst.mockResolvedValue(mockPayment);
      mockPrisma.shopItem.update.mockResolvedValue({});
      mockNotificationManager.createNotification.mockResolvedValue({});
      mockRedis.publish.mockResolvedValue(1);
      mockRedis.del.mockResolvedValue(1);

      const response = await app.handle(
        new Request('http://localhost/payments/webhooks/local-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notificationData),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.message).toBe('OK');
      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: PaymentStatus.SUCCESS } }));
      expect(mockPrisma.shopItem.update).toHaveBeenCalledWith({
        where: { id: 'shopItem1' },
        data: {
          stock: { decrement: 1 },
          reservedStock: { decrement: 1 },
        },
      });
      expect(mockNotificationManager.createNotification).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith(`pending_payment:${mockPayment.id}`);
    });

    it('should handle local payment notification (failed) and release reserved stock', async () => {
      const notificationData = { order_id: 'order123', transaction_status: 'expire', transaction_id: 'midtrans_tx_123' };
      const mockPayment = { id: 'payment1', userId: 'user123', entityType: PaymentEntityType.SHOP_ITEM, entityId: 'shopItem1', quantity: 1 };
      const mockShopItem = { id: 'shopItem1', stock: 5, reservedStock: 1 };

      mockLocalPaymentService.handleNotification.mockResolvedValue(notificationData);
      mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.payment.findFirst.mockResolvedValue(mockPayment);
      mockPrisma.shopItem.update.mockResolvedValue({});
      mockNotificationManager.createNotification.mockResolvedValue({});
      mockRedis.publish.mockResolvedValue(1);
      mockRedis.del.mockResolvedValue(1);

      const response = await app.handle(
        new Request('http://localhost/payments/webhooks/local-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notificationData),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.message).toBe('OK');
      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: PaymentStatus.FAILED } }));
      expect(mockPrisma.shopItem.update).toHaveBeenCalledWith({
        where: { id: 'shopItem1' },
        data: { reservedStock: { decrement: 1 } },
      });
      expect(mockNotificationManager.createNotification).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith(`pending_payment:${mockPayment.id}`);
    });

    // Add more webhook tests for Stripe, PayPal, Crypto, Amazon, Apple, Google
  });
});