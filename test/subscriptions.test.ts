import { describe, expect, it, beforeEach } from 'bun:test';
import app from '../src/index';
import { prisma } from '../src/lib/prisma';
import { PaymentGateway, SubscriptionStatus, UserRole } from '@prisma/client';
import { stripeService } from '../src/services/stripe.service';
import { payPalService } from '../src/services/paypal.service';
import { localPaymentService } from '../src/services/local_payment.service';
import { amazonService } from '../src/services/amazon.service';
import { appleService } from '../src/services/apple.service';
import { googleService } from '../src/services/google.service';
import { NotificationManager } from '../src/utils/notification.manager';
import { redisPublisher } from '../src/plugins/redis.plugin';

// Mock Prisma and external services
const mockPrisma = {
  subscription: {
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockStripeService = {
  createSubscription: jest.fn(),
  cancelSubscription: jest.fn(),
};

const mockPayPalService = {
  createOrder: jest.fn(),
};

const mockLocalPaymentService = {};
const mockAmazonService = {};
const mockAppleService = {};
const mockGoogleService = {};

const mockNotificationManager = {
  createNotification: jest.fn(),
};

const mockRedisPublisher = {
  publish: jest.fn(),
};

// Replace actual imports with mocks
// @ts-ignore
prisma = mockPrisma;
// @ts-ignore
stripeService = mockStripeService;
// @ts-ignore
payPalService = mockPayPalService;
// @ts-ignore
localPaymentService = mockLocalPaymentService;
// @ts-ignore
amazonService = mockAmazonService;
// @ts-ignore
appleService = mockAppleService;
// @ts-ignore
googleService = mockGoogleService;
// @ts-ignore
NotificationManager = mockNotificationManager;
// @ts-ignore
redisPublisher = mockRedisPublisher;

const mockUserToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXJJZDEyMyIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsInJvbGUiOiJVU0VSIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMTcyMDB9.dummy_user_token';

describe('Subscriptions Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /subscriptions/create', () => {
    it('should create a new subscription successfully for Stripe', async () => {
      const subscriptionData = {
        plan: 'premium',
        paymentGateway: PaymentGateway.STRIPE,
      };
      const mockStripeSubscription = { id: 'sub_stripe123' };

      mockStripeService.createSubscription.mockResolvedValue(mockStripeSubscription);
      mockPrisma.subscription.create.mockResolvedValue({
        id: 'sub1',
        userId: 'userId123',
        ...subscriptionData,
        status: SubscriptionStatus.ACTIVE,
      });
      mockNotificationManager.createNotification.mockResolvedValue({});
      mockRedisPublisher.publish.mockResolvedValue(1);

      const response = await app.handle(
        new Request('http://localhost/subscriptions/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockUserToken}`,
          },
          body: JSON.stringify(subscriptionData),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe('sub1');
      expect(mockPrisma.subscription.create).toHaveBeenCalled();
      expect(mockNotificationManager.createNotification).toHaveBeenCalled();
      expect(mockRedisPublisher.publish).toHaveBeenCalled();
    });

    it('should return 401 if not authenticated', async () => {
      const subscriptionData = {
        plan: 'premium',
        paymentGateway: PaymentGateway.STRIPE,
      };

      const response = await app.handle(
        new Request('http://localhost/subscriptions/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscriptionData),
        })
      );

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /subscriptions/:id/status', () => {
    it('should update subscription status to CANCELLED for Stripe', async () => {
      const subscriptionId = 'sub1';
      const existingSubscription = { id: subscriptionId, userId: 'userId123', plan: 'premium', paymentGateway: PaymentGateway.STRIPE, stripeId: 'sub_stripe123' };

      mockPrisma.subscription.update.mockResolvedValue({ ...existingSubscription, status: SubscriptionStatus.CANCELLED });
      mockStripeService.cancelSubscription.mockResolvedValue({});
      mockNotificationManager.createNotification.mockResolvedValue({});
      mockRedisPublisher.publish.mockResolvedValue(1);

      const response = await app.handle(
        new Request(`http://localhost/subscriptions/${subscriptionId}/status`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mockUserToken}`,
            },
            body: JSON.stringify({ status: SubscriptionStatus.CANCELLED }),
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe(SubscriptionStatus.CANCELLED);
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: subscriptionId },
        data: { status: SubscriptionStatus.CANCELLED },
      });
      expect(mockStripeService.cancelSubscription).toHaveBeenCalledWith('sub_stripe123');
      expect(mockNotificationManager.createNotification).toHaveBeenCalled();
      expect(mockRedisPublisher.publish).toHaveBeenCalled();
    });

    it('should return 401 if not authenticated', async () => {
      const subscriptionId = 'sub1';

      const response = await app.handle(
        new Request(`http://localhost/subscriptions/${subscriptionId}/status`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: SubscriptionStatus.CANCELLED }),
          })
      );

      expect(response.status).toBe(401);
    });
  });

  describe('GET /subscriptions/me', () => {
    it('should return all subscriptions for the authenticated user', async () => {
      const mockSubscriptions = [
        { id: 'sub1', userId: 'userId123', plan: 'basic', status: SubscriptionStatus.ACTIVE },
        { id: 'sub2', userId: 'userId123', plan: 'pro', status: SubscriptionStatus.INACTIVE },
      ];
      mockPrisma.subscription.findMany.mockResolvedValue(mockSubscriptions);

      const response = await app.handle(
        new Request('http://localhost/subscriptions/me', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${mockUserToken}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual(mockSubscriptions);
      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith({
        where: { userId: 'userId123' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return 401 if not authenticated', async () => {
      const response = await app.handle(
        new Request('http://localhost/subscriptions/me', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(401);
    });
  });
});