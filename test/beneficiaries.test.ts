import { describe, expect, it, beforeEach } from 'bun:test';
import app from '../src/index';
import { prisma } from '../src/lib/prisma';
import { redisPublisher } from '../src/plugins/redis.plugin';

// Mock Prisma and RedisPublisher
const mockPrisma = {
  beneficiary: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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

const mockUserToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXJJZDEyMyIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsInJvbGUiOiJVU0VSIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMTcyMDB9.dummy_user_token';

describe('Beneficiaries Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /beneficiaries', () => {
    it('should create a new beneficiary successfully', async () => {
      const newBeneficiary = {
        name: 'John Doe',
        account: '1234567890',
        bank: 'Test Bank',
        aliasName: 'JohnsAccount',
        email: 'john.doe@example.com',
      };

      mockPrisma.beneficiary.create.mockResolvedValue({
        id: 'beneficiary1',
        userId: 'userId123',
        ...newBeneficiary,
      });
      mockRedisPublisher.del.mockResolvedValue(1);

      const response = await app.handle(
        new Request('http://localhost/beneficiaries', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockUserToken}`,
          },
          body: JSON.stringify(newBeneficiary),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.aliasName).toBe('JohnsAccount');
      expect(mockPrisma.beneficiary.create).toHaveBeenCalledWith({
        data: { ...newBeneficiary, userId: 'userId123' },
      });
      expect(mockRedisPublisher.del).toHaveBeenCalledWith('beneficiaries:user:userId123');
    });

    it('should return 401 if not authenticated', async () => {
      const newBeneficiary = {
        name: 'John Doe',
        account: '1234567890',
        bank: 'Test Bank',
        aliasName: 'JohnsAccount',
        email: 'john.doe@example.com',
      };

      const response = await app.handle(
        new Request('http://localhost/beneficiaries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newBeneficiary),
        })
      );

      expect(response.status).toBe(401);
    });
  });

  describe('GET /beneficiaries', () => {
    it('should return a list of beneficiaries for the authenticated user (from cache)', async () => {
      const mockBeneficiaries = [
        { id: 'b1', userId: 'userId123', aliasName: 'MyAccount1' },
        { id: 'b2', userId: 'userId123', aliasName: 'MyAccount2' },
      ];
      mockRedisPublisher.get.mockResolvedValue(JSON.stringify(mockBeneficiaries));

      const response = await app.handle(
        new Request('http://localhost/beneficiaries', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${mockUserToken}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual(mockBeneficiaries);
      expect(mockRedisPublisher.get).toHaveBeenCalledWith('beneficiaries:user:userId123');
      expect(mockPrisma.beneficiary.findMany).not.toHaveBeenCalled();
    });

    it('should return a list of beneficiaries for the authenticated user (from DB)', async () => {
      const mockBeneficiaries = [
        { id: 'b1', userId: 'userId123', aliasName: 'MyAccount1' },
        { id: 'b2', userId: 'userId123', aliasName: 'MyAccount2' },
      ];
      mockRedisPublisher.get.mockResolvedValue(null);
      mockPrisma.beneficiary.findMany.mockResolvedValue(mockBeneficiaries);
      mockRedisPublisher.set.mockResolvedValue('OK');

      const response = await app.handle(
        new Request('http://localhost/beneficiaries', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${mockUserToken}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual(mockBeneficiaries);
      expect(mockRedisPublisher.get).toHaveBeenCalledWith('beneficiaries:user:userId123');
      expect(mockPrisma.beneficiary.findMany).toHaveBeenCalledWith({ where: { userId: 'userId123' } });
      expect(mockRedisPublisher.set).toHaveBeenCalledWith('beneficiaries:user:userId123', JSON.stringify(mockBeneficiaries), 'EX', 3600);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await app.handle(
        new Request('http://localhost/beneficiaries', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /beneficiaries/:id', () => {
    it('should update a beneficiary successfully', async () => {
      const beneficiaryId = 'beneficiary1';
      const updatedData = { name: 'Jane Doe', email: 'jane.doe@example.com' };
      const existingBeneficiary = { id: beneficiaryId, userId: 'userId123', aliasName: 'JohnsAccount' };

      mockPrisma.beneficiary.findFirst.mockResolvedValue(existingBeneficiary);
      mockPrisma.beneficiary.update.mockResolvedValue({ ...existingBeneficiary, ...updatedData });
      mockRedisPublisher.del.mockResolvedValue(1);

      const response = await app.handle(
        new Request(`http://localhost/beneficiaries/${beneficiaryId}`,
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
      expect(body.name).toBe('Jane Doe');
      expect(mockPrisma.beneficiary.update).toHaveBeenCalledWith({
        where: { id: beneficiaryId },
        data: updatedData,
      });
      expect(mockRedisPublisher.del).toHaveBeenCalledWith('beneficiaries:user:userId123');
    });

    it('should return 404 if beneficiary not found or does not belong to user', async () => {
      const beneficiaryId = 'nonexistent_b';
      const updatedData = { name: 'Jane Doe' };

      mockPrisma.beneficiary.findFirst.mockResolvedValue(null);

      const response = await app.handle(
        new Request(`http://localhost/beneficiaries/${beneficiaryId}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mockUserToken}`,
            },
            body: JSON.stringify(updatedData),
          })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.message).toBe('Beneficiary not found or you do not have permission to update it.');
    });

    it('should return 401 if not authenticated', async () => {
      const beneficiaryId = 'beneficiary1';
      const updatedData = { name: 'Jane Doe' };

      const response = await app.handle(
        new Request(`http://localhost/beneficiaries/${beneficiaryId}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData),
          })
      );

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /beneficiaries/:id', () => {
    it('should delete a beneficiary successfully', async () => {
      const beneficiaryId = 'beneficiary1';
      const existingBeneficiary = { id: beneficiaryId, userId: 'userId123' };

      mockPrisma.beneficiary.findFirst.mockResolvedValue(existingBeneficiary);
      mockPrisma.beneficiary.delete.mockResolvedValue(existingBeneficiary);
      mockRedisPublisher.del.mockResolvedValue(1);

      const response = await app.handle(
        new Request(`http://localhost/beneficiaries/${beneficiaryId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${mockUserToken}`,
            },
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual(existingBeneficiary);
      expect(mockPrisma.beneficiary.delete).toHaveBeenCalledWith({ where: { id: beneficiaryId } });
      expect(mockRedisPublisher.del).toHaveBeenCalledWith('beneficiaries:user:userId123');
    });

    it('should return 404 if beneficiary not found or does not belong to user', async () => {
      const beneficiaryId = 'nonexistent_b';

      mockPrisma.beneficiary.findFirst.mockResolvedValue(null);

      const response = await app.handle(
        new Request(`http://localhost/beneficiaries/${beneficiaryId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${mockUserToken}`,
            },
          })
      );

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.message).toBe('Beneficiary not found or you do not have permission to delete it.');
    });

    it('should return 401 if not authenticated', async () => {
      const beneficiaryId = 'beneficiary1';

      const response = await app.handle(
        new Request(`http://localhost/beneficiaries/${beneficiaryId}`,
          {
            method: 'DELETE',
          })
      );

      expect(response.status).toBe(401);
    });
  });
});