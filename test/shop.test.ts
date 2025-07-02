import { describe, expect, it, beforeEach } from 'bun:test';
import app from '../src/index';
import { prisma } from '../src/lib/prisma';
import { PaymentGateway, PaymentEntityType, PaymentType, ShopItemStatus, UserRole } from '@prisma/client';

// Mock Prisma
const mockPrisma = {
  shopItem: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

// Mock PaymentService (since it's used in purchaseItem)
const mockPaymentService = {
  create: jest.fn(),
};

// Replace actual imports with mocks
// @ts-ignore
prisma = mockPrisma;
// @ts-ignore
// Mocking PaymentService directly in the test file for simplicity
// In a real app, you might want to mock the entire module or use a DI container
const PaymentService = mockPaymentService;

const mockUserToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXJJZDEyMyIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsInJvbGUiOiJVU0VSIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMTcyMDB9.dummy_user_token';
const mockInstructorToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Imluc3RydWN0b3JJZDEyMyIsImVtYWlsIjoiaW5zdHJ1Y3RvckBleGFtcGxlLmNvbSIsInJvbGUiOiJJTlNUUlVDVE9SIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMTcyMDB9.dummy_instructor_token';
const mockAdminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFkbWluVXNlcklkIiwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxNzAwMDE3MjAwfQ.dummy_admin_token';

describe('Shop Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /shop', () => {
    it('should create a new shop item successfully', async () => {
      const newItem = {
        name: 'Test Product',
        description: 'A great product.',
        price: 10.00,
        stock: 100,
        sellerId: 'userId123',
      };

      mockPrisma.shopItem.create.mockResolvedValue({
        id: 'item1',
        ...newItem,
        status: ShopItemStatus.AVAILABLE,
      });

      const response = await app.handle(
        new Request('http://localhost/shop', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockUserToken}`,
          },
          body: JSON.stringify(newItem),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.name).toBe(newItem.name);
      expect(mockPrisma.shopItem.create).toHaveBeenCalledWith({
        data: newItem,
      });
    });

    it('should return 401 if not authenticated', async () => {
      const newItem = {
        name: 'Test Product',
        description: 'A great product.',
        price: 10.00,
        stock: 100,
        sellerId: 'userId123',
      };

      const response = await app.handle(
        new Request('http://localhost/shop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newItem),
        })
      );

      expect(response.status).toBe(401);
    });
  });

  describe('GET /shop', () => {
    it('should return a list of shop items', async () => {
      const mockItems = [
        { id: 's1', name: 'Item 1', price: 10, stock: 50 },
        { id: 's2', name: 'Item 2', price: 20, stock: 30 },
      ];
      mockPrisma.shopItem.findMany.mockResolvedValue(mockItems);
      mockPrisma.shopItem.count.mockResolvedValue(2);

      const response = await app.handle(
        new Request('http://localhost/shop', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.shopItems).toEqual(mockItems);
      expect(body.total).toBe(2);
    });
  });

  describe('GET /shop/:id', () => {
    it('should return a single shop item', async () => {
      const mockItem = { id: 's1', name: 'Item 1', price: 10, stock: 50 };
      mockPrisma.shopItem.findUnique.mockResolvedValue(mockItem);

      const response = await app.handle(
        new Request('http://localhost/shop/s1', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.name).toBe('Item 1');
      expect(mockPrisma.shopItem.findUnique).toHaveBeenCalledWith({ where: { id: 's1' } });
    });

    it('should return 404 if shop item not found', async () => {
      mockPrisma.shopItem.findUnique.mockResolvedValue(null);

      const response = await app.handle(
        new Request('http://localhost/shop/non-existent-item', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /shop/:id', () => {
    it('should update a shop item successfully by seller', async () => {
      const itemId = 'item1';
      const existingItem = { id: itemId, name: 'Old Name', sellerId: 'userId123', price: 10, stock: 100 };
      const updatedData = { name: 'New Name', price: 15.00 };

      mockPrisma.shopItem.findUnique.mockResolvedValue(existingItem);
      mockPrisma.shopItem.update.mockResolvedValue({ ...existingItem, ...updatedData });

      const response = await app.handle(
        new Request(`http://localhost/shop/${itemId}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mockUserToken}`,
            },
            body: JSON.stringify(updatedData),
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.name).toBe('New Name');
      expect(body.price).toBe(15.00);
      expect(mockPrisma.shopItem.update).toHaveBeenCalledWith({
        where: { id: itemId },
        data: updatedData,
      });
    });

    it('should return 403 if user is not seller or admin', async () => {
      const itemId = 'item1';
      const existingItem = { id: itemId, name: 'Old Name', sellerId: 'otherSeller', price: 10, stock: 100 };
      const updatedData = { name: 'New Name' };

      mockPrisma.shopItem.findUnique.mockResolvedValue(existingItem);

      const response = await app.handle(
        new Request(`http://localhost/shop/${itemId}`,
          {
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

  describe('DELETE /shop/:id', () => {
    it('should delete a shop item successfully by seller', async () => {
      const itemId = 'item1';
      const existingItem = { id: itemId, name: 'Item to Delete', sellerId: 'userId123' };

      mockPrisma.shopItem.findUnique.mockResolvedValue(existingItem);
      mockPrisma.shopItem.delete.mockResolvedValue(existingItem);

      const response = await app.handle(
        new Request(`http://localhost/shop/${itemId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${mockUserToken}`,
            },
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe(itemId);
      expect(mockPrisma.shopItem.delete).toHaveBeenCalledWith({ where: { id: itemId } });
    });

    it('should return 403 if user is not seller or admin', async () => {
      const itemId = 'item1';
      const existingItem = { id: itemId, name: 'Item to Delete', sellerId: 'otherSeller' };

      mockPrisma.shopItem.findUnique.mockResolvedValue(existingItem);

      const response = await app.handle(
        new Request(`http://localhost/shop/${itemId}`,
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

  describe('POST /shop/:id/purchase', () => {
    it('should purchase a shop item successfully', async () => {
      const itemId = 'item1';
      const mockShopItem = { id: itemId, name: 'Test Item', price: 10, stock: 10, reservedStock: 0 };
      const mockPayment = { id: 'payment1', amount: 20, status: 'PENDING' };

      mockPrisma.shopItem.findUnique.mockResolvedValue(mockShopItem);
      mockPrisma.shopItem.update.mockResolvedValue({ ...mockShopItem, reservedStock: 2 });
      mockPaymentService.create.mockResolvedValue(mockPayment);

      const response = await app.handle(
        new Request(`http://localhost/shop/${itemId}/purchase`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mockUserToken}`,
            },
            body: JSON.stringify({ quantity: 2, paymentGateway: PaymentGateway.STRIPE }),
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe('payment1');
      expect(mockPrisma.shopItem.update).toHaveBeenCalledWith({
        where: { id: itemId },
        data: { reservedStock: { increment: 2 } },
      });
      expect(mockPaymentService.create).toHaveBeenCalledWith({
        userId: 'userId123',
        amount: 20,
        paymentType: PaymentType.SHOP_ITEM_PURCHASE,
        entityId: itemId,
        entityType: PaymentEntityType.SHOP_ITEM,
        paymentGateway: PaymentGateway.STRIPE,
        quantity: 2,
      });
    });

    it('should return 400 if not enough stock available', async () => {
      const itemId = 'item1';
      const mockShopItem = { id: itemId, name: 'Test Item', price: 10, stock: 1, reservedStock: 0 };

      mockPrisma.shopItem.findUnique.mockResolvedValue(mockShopItem);

      const response = await app.handle(
        new Request(`http://localhost/shop/${itemId}/purchase`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mockUserToken}`,
            },
            body: JSON.stringify({ quantity: 2, paymentGateway: PaymentGateway.STRIPE }),
          })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.message).toBe('Not enough available stock');
    });

    it('should return 404 if shop item not found for purchase', async () => {
      const itemId = 'nonexistent_item';

      mockPrisma.shopItem.findUnique.mockResolvedValue(null);

      const response = await app.handle(
        new Request(`http://localhost/shop/${itemId}/purchase`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mockUserToken}`,
            },
            body: JSON.stringify({ quantity: 1, paymentGateway: PaymentGateway.STRIPE }),
          })
      );

      expect(response.status).toBe(404);
    });

    it('should return 401 if not authenticated for purchase', async () => {
      const itemId = 'item1';

      const response = await app.handle(
        new Request(`http://localhost/shop/${itemId}/purchase`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: 1, paymentGateway: PaymentGateway.STRIPE }),
          })
      );

      expect(response.status).toBe(401);
    });
  });
});