import { describe, expect, it, beforeEach } from 'bun:test';
import app from '../src/index';
import { prisma } from '../src/lib/prisma';
import { PaymentGateway, UserRole } from '@prisma/client';
import { stripeService } from '../src/services/stripe.service';
import { localPaymentService } from '../src/services/local_payment.service';
import { amazonService } from '../src/services/amazon.service';
import { appleService } from '../src/services/apple.service';
import { googleService } from '../src/services/google.service';

// Mock Prisma and external services
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  cardRegistration: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
};

const mockStripeService = {
  createCustomer: jest.fn(),
  attachPaymentMethod: jest.fn(),
};

const mockLocalPaymentService = {
  provider: 'MIDTRANS',
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
localPaymentService = mockLocalPaymentService;
// @ts-ignore
amazonService = mockAmazonService;
// @ts-ignore
appleService = mockAppleService;
// @ts-ignore
googleService = mockGoogleService;

const mockUserToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXJJZDEyMyIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsInJvbGUiOiJVU0VSIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMTcyMDB9.dummy_user_token';

describe('Cards Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /cards/register', () => {
    it('should register a new card successfully for STRIPE', async () => {
      const cardData = {
        paymentGateway: PaymentGateway.STRIPE,
        token: 'pm_card_visa',
        cardType: 'Visa',
        maskedCard: '4242',
        bank: 'Test Bank',
      };

      mockPrisma.user.findUnique.mockResolvedValue({ id: 'userId123', email: 'user@example.com', stripeCustomerId: null });
      mockStripeService.createCustomer.mockResolvedValue({ id: 'cus_123' });
      mockStripeService.attachPaymentMethod.mockResolvedValue({});
      mockPrisma.cardRegistration.create.mockResolvedValue({ id: 'card1', userId: 'userId123', ...cardData });

      const response = await app.handle(
        new Request('http://localhost/cards/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockUserToken}`,
          },
          body: JSON.stringify(cardData),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe('card1');
      expect(body.maskedCard).toBe('4242');
      expect(mockPrisma.cardRegistration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'userId123',
          cardToken: cardData.token,
          cardType: cardData.cardType,
          maskedCard: cardData.maskedCard,
          paymentGateway: cardData.paymentGateway,
          bank: cardData.bank,
          stripeId: cardData.token,
        }),
      });
    });

    it('should return 401 if not authenticated', async () => {
      const cardData = {
        paymentGateway: PaymentGateway.STRIPE,
        token: 'pm_card_visa',
        cardType: 'Visa',
        maskedCard: '4242',
        bank: 'Test Bank',
      };

      const response = await app.handle(
        new Request('http://localhost/cards/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cardData),
        })
      );

      expect(response.status).toBe(401);
    });
  });

  describe('GET /cards', () => {
    it('should return all cards for the authenticated user', async () => {
      const mockCards = [
        { id: 'c1', userId: 'userId123', maskedCard: '1111', paymentGateway: PaymentGateway.STRIPE },
        { id: 'c2', userId: 'userId123', maskedCard: '2222', paymentGateway: PaymentGateway.LOCAL_PAYMENT },
      ];
      mockPrisma.cardRegistration.findMany.mockResolvedValue(mockCards);

      const response = await app.handle(
        new Request('http://localhost/cards', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${mockUserToken}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual(mockCards);
      expect(mockPrisma.cardRegistration.findMany).toHaveBeenCalledWith({
        where: { userId: 'userId123' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return 401 if not authenticated', async () => {
      const response = await app.handle(
        new Request('http://localhost/cards', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /cards/:id', () => {
    it('should delete a card successfully', async () => {
      const cardId = 'card1';
      mockPrisma.cardRegistration.findUnique.mockResolvedValue({ id: cardId, userId: 'userId123' });
      mockPrisma.cardRegistration.delete.mockResolvedValue({ id: cardId });

      const response = await app.handle(
        new Request(`http://localhost/cards/${cardId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${mockUserToken}`,
            },
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ id: cardId });
      expect(mockPrisma.cardRegistration.delete).toHaveBeenCalledWith({ where: { id: cardId } });
    });

    it('should return 404 if card not found or does not belong to user', async () => {
      const cardId = 'nonexistent_card';
      mockPrisma.cardRegistration.findUnique.mockResolvedValue(null);

      const response = await app.handle(
        new Request(`http://localhost/cards/${cardId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${mockUserToken}`,
            },
          })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.message).toBe('Card not found or unauthorized');
    });

    it('should return 401 if not authenticated', async () => {
      const cardId = 'card1';
      const response = await app.handle(
        new Request(`http://localhost/cards/${cardId}`,
          {
            method: 'DELETE',
          })
      );

      expect(response.status).toBe(401);
    });
  });
});