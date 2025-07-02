import { describe, expect, it, beforeEach } from 'bun:test';
import app from '../src/index';
import { prisma } from '../src/lib/prisma';
import { PaymentGateway, UserRole } from '@prisma/client';
import { stripeService } from '../src/services/stripe.service';
import { amazonService } from '../src/services/amazon.service';
import { appleService } from '../src/services/apple.service';
import { googleService } from '../src/services/google.service';

// Mock Prisma and external services
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  paymentAccount: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
};

const mockStripeService = {
  createAccount: jest.fn(),
};

const mockAmazonService = {};
const mockAppleService = {};
const mockGoogleService = {};

// Replace actual imports with mocks
// @ts-ignore
prisma = mockPrisma;
// @ts-ignore
stripeService = mockStripeService;
// @ts-ignore
amazonService = mockAmazonService;
// @ts-ignore
appleService = mockAppleService;
// @ts-ignore
googleService = mockGoogleService;

const mockAdminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFkbWluVXNlcklkIiwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxNzAwMDE3MjAwfQ.dummy_admin_token';
const mockUserToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXJJZDEyMyIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsInJvbGUiOiJVU0VSIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMTcyMDB9.dummy_user_token';

describe('Payment Accounts Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /payment-accounts/link', () => {
    it('should link a new payment account successfully for STRIPE', async () => {
      const linkData = {
        accountType: 'bank_account',
        accountDetails: { bankName: 'Test Bank', accountNumber: '123456789' },
        paymentGateway: PaymentGateway.STRIPE,
      };

      mockPrisma.user.findUnique.mockResolvedValue({ id: 'userId123', stripeAccountId: null });
      mockStripeService.createAccount.mockResolvedValue({ id: 'stripeAcc123' });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.paymentAccount.create.mockResolvedValue({ id: 'pa1', ...linkData, userId: 'userId123' });

      const response = await app.handle(
        new Request('http://localhost/payment-accounts/link', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockUserToken}`,
          },
          body: JSON.stringify(linkData),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ id: 'pa1', ...linkData, userId: 'userId123' });
      expect(mockPrisma.paymentAccount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'userId123',
          accountType: linkData.accountType,
          accountDetails: linkData.accountDetails,
          paymentGateway: linkData.paymentGateway,
          stripeAccountId: 'stripeAcc123',
        }),
      });
    });

    it('should return 401 if not authenticated', async () => {
      const linkData = {
        accountType: 'bank_account',
        accountDetails: { bankName: 'Test Bank', accountNumber: '123456789' },
        paymentGateway: PaymentGateway.STRIPE,
      };

      const response = await app.handle(
        new Request('http://localhost/payment-accounts/link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(linkData),
        })
      );

      expect(response.status).toBe(401);
    });
  });

  describe('GET /payment-accounts', () => {
    it('should return all payment accounts for the authenticated user', async () => {
      const mockAccounts = [
        { id: 'pa1', userId: 'userId123', accountType: 'bank', paymentGateway: PaymentGateway.STRIPE },
        { id: 'pa2', userId: 'userId123', accountType: 'ewallet', paymentGateway: PaymentGateway.LOCAL_PAYMENT },
      ];
      mockPrisma.paymentAccount.findMany.mockResolvedValue(mockAccounts);

      const response = await app.handle(
        new Request('http://localhost/payment-accounts', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${mockUserToken}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual(mockAccounts);
      expect(mockPrisma.paymentAccount.findMany).toHaveBeenCalledWith({ where: { userId: 'userId123' } });
    });

    it('should return 401 if not authenticated', async () => {
      const response = await app.handle(
        new Request('http://localhost/payment-accounts', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /payment-accounts/:id', () => {
    it('should unlink a payment account successfully', async () => {
      const accountId = 'pa1';
      mockPrisma.paymentAccount.findFirst.mockResolvedValue({ id: accountId, userId: 'userId123' });
      mockPrisma.paymentAccount.delete.mockResolvedValue({ id: accountId });

      const response = await app.handle(
        new Request(`http://localhost/payment-accounts/${accountId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${mockUserToken}`,
            },
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ id: accountId });
      expect(mockPrisma.paymentAccount.delete).toHaveBeenCalledWith({ where: { id: accountId } });
    });

    it('should return 404 if account not found or does not belong to user', async () => {
      const accountId = 'nonexistent_pa';
      mockPrisma.paymentAccount.findFirst.mockResolvedValue(null);

      const response = await app.handle(
        new Request(`http://localhost/payment-accounts/${accountId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${mockUserToken}`,
            },
          })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.message).toBe('Payment account not found or you do not have permission to unlink it.');
    });

    it('should return 401 if not authenticated', async () => {
      const accountId = 'pa1';
      const response = await app.handle(
        new Request(`http://localhost/payment-accounts/${accountId}`,
          {
            method: 'DELETE',
          })
      );

      expect(response.status).toBe(401);
    });
  });
});