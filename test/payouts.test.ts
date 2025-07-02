import { describe, expect, it, beforeEach } from 'bun:test';
import app from '../src/index';
import { prisma } from '../src/lib/prisma';
import { PayoutGateway, PayoutStatus, UserRole } from '@prisma/client';
import { localPaymentService } from '../src/services/local_payment.service';
import { stripeService } from '../src/services/stripe.service';
import { payPalService } from '../src/services/paypal.service';
import { cryptoPaymentService } from '../src/services/crypto_payment.service';
import { amazonService } from '../src/services/amazon.service';
import { appleService } from '../src/services/apple.service';
import { googleService } from '../src/services/google.service';
import { redis } from '../src/plugins/redis.plugin';

// Mock Prisma and external services
const mockPrisma = {
  beneficiary: {
    findFirst: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  payout: {
    create: jest.fn(),
    findFirst: jest.fn(),
  },
};

const mockLocalPaymentService = {
  provider: 'MIDTRANS_IRIS',
  createPayout: jest.fn(),
  getPayoutStatus: jest.fn(),
};

const mockStripeService = {
  createTransfer: jest.fn(),
  retrieveTransfer: jest.fn(),
};

const mockPayPalService = {
  createPayout: jest.fn(),
  getPayoutStatus: jest.fn(),
};

const mockCryptoPaymentService = {
  provider: 'COINGATE_PAYOUT',
  createPayout: jest.fn(),
  getPayoutStatus: jest.fn(),
};

const mockAmazonService = {
  createPayout: jest.fn(),
  getPayoutStatus: jest.fn(),
};

const mockAppleService = {
  createPayout: jest.fn(),
  getPayoutStatus: jest.fn(),
};

const mockGoogleService = {
  createPayout: jest.fn(),
  getPayoutStatus: jest.fn(),
};

const mockRedis = {
  publish: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  get: jest.fn(),
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

const mockAdminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFkbWluVXNlcklkIiwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxNzAwMDE3MjAwfQ.dummy_admin_token';
const mockInstructorToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Imluc3RydWN0b3JJZDEyMyIsImVtYWlsIjoiaW5zdHJ1Y3RvckBleGFtcGxlLmNvbSIsInJvbGUiOiJJTlNUUlVDVE9SIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMTcyMDB9.dummy_instructor_token';

describe('Payouts Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /payouts', () => {
    it('should create a local payout successfully', async () => {
      const payoutData = {
        beneficiaryId: 'beneficiary1',
        amount: 100,
        notes: 'Monthly payout',
        payoutGateway: PayoutGateway.LOCAL_PAYOUT,
      };
      const mockBeneficiary = { id: 'beneficiary1', userId: 'userId123', name: 'John Doe', account: '123', bank: 'Test Bank', email: 'john@example.com' };
      const mockPayoutResult = { reference_no: 'payout_ref_123' };

      mockPrisma.beneficiary.findFirst.mockResolvedValue(mockBeneficiary);
      mockLocalPaymentService.createPayout.mockResolvedValue(mockPayoutResult);
      mockPrisma.payout.create.mockResolvedValue({ id: 'payout1', ...payoutData, userId: 'userId123' });
      mockRedis.del.mockResolvedValue(1);

      const response = await app.handle(
        new Request('http://localhost/payouts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockInstructorToken}`,
          },
          body: JSON.stringify(payoutData),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe('payout1');
      expect(mockPrisma.payout.create).toHaveBeenCalled();
      expect(mockRedisPublisher.del).toHaveBeenCalledWith(`payout:${body.id}`);
    });

    it('should return 401 if not authenticated', async () => {
      const payoutData = {
        beneficiaryId: 'beneficiary1',
        amount: 100,
        notes: 'Monthly payout',
        payoutGateway: PayoutGateway.LOCAL_PAYOUT,
      };

      const response = await app.handle(
        new Request('http://localhost/payouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payoutData),
        })
      );

      expect(response.status).toBe(401);
    });

    it('should return 403 if user does not have ADMIN or INSTRUCTOR role', async () => {
      const payoutData = {
        beneficiaryId: 'beneficiary1',
        amount: 100,
        notes: 'Monthly payout',
        payoutGateway: PayoutGateway.LOCAL_PAYOUT,
      };

      const mockUserToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXJJZDEyMyIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsInJvbGUiOiJVU0VSIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMTcyMDB9.dummy_user_token';

      const response = await app.handle(
        new Request('http://localhost/payouts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockUserToken}`,
          },
          body: JSON.stringify(payoutData),
        })
      );

      expect(response.status).toBe(403);
    });
  });

  describe('GET /payouts/:referenceNo/status', () => {
    it('should return payout status for local payout (from cache)', async () => {
      const referenceNo = 'payout_ref_123';
      const mockPayout = { id: 'payout1', midtransId: referenceNo, payoutGateway: PayoutGateway.LOCAL_PAYOUT, userId: 'userId123' };
      const mockStatusResult = { status: 'COMPLETED' };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockStatusResult));
      mockPrisma.payout.findFirst.mockResolvedValue(mockPayout);

      const response = await app.handle(
        new Request(`http://localhost/payouts/${referenceNo}/status`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${mockInstructorToken}`,
            },
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual(mockStatusResult);
      expect(mockRedis.get).toHaveBeenCalledWith(`payout:${referenceNo}`);
      expect(mockPrisma.payout.findFirst).not.toHaveBeenCalled();
    });

    it('should return payout status for local payout (from DB and cache)', async () => {
      const referenceNo = 'payout_ref_123';
      const mockPayout = { id: 'payout1', midtransId: referenceNo, payoutGateway: PayoutGateway.LOCAL_PAYOUT, userId: 'userId123' };
      const mockStatusResult = { status: 'COMPLETED' };

      mockRedisPublisher.get.mockResolvedValue(null);
      mockPrisma.payout.findFirst.mockResolvedValue(mockPayout);
      mockLocalPaymentService.getPayoutStatus.mockResolvedValue(mockStatusResult);
      mockRedisPublisher.set.mockResolvedValue('OK');

      const response = await app.handle(
        new Request(`http://localhost/payouts/${referenceNo}/status`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${mockInstructorToken}`,
            },
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual(mockStatusResult);
      expect(mockRedis.get).toHaveBeenCalledWith(`payout:${referenceNo}`);
      expect(mockPrisma.payout.findFirst).toHaveBeenCalled();
      expect(mockLocalPaymentService.getPayoutStatus).toHaveBeenCalledWith(referenceNo);
      expect(mockRedisPublisher.set).toHaveBeenCalledWith(`payout:${referenceNo}`, JSON.stringify(mockStatusResult), 'EX', 60);
    });

    it('should return 404 if payout not found or does not belong to user', async () => {
      const referenceNo = 'nonexistent_ref';

      mockPrisma.payout.findFirst.mockResolvedValue(null);

      const response = await app.handle(
        new Request(`http://localhost/payouts/${referenceNo}/status`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${mockInstructorToken}`,
            },
          })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.message).toBe('Payout not found or you do not have permission to view it.');
    });

    it('should return 401 if not authenticated', async () => {
      const referenceNo = 'payout_ref_123';

      const response = await app.handle(
        new Request(`http://localhost/payouts/${referenceNo}/status`,
          {
            method: 'GET',
          })
      );

      expect(response.status).toBe(401);
    });
  });
});