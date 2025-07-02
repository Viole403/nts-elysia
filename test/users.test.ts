import { describe, expect, it, beforeEach } from 'bun:test';
import app from '../src/index';
import { prisma } from '../src/lib/prisma';
import { UserRole } from '@prisma/client';

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  userProfile: {
    upsert: jest.fn(),
  },
};

// Replace actual imports with mocks
// @ts-ignore
prisma = mockPrisma;

const mockUserToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXJJZDEyMyIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsInJvbGUiOiJVU0VSIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMTcyMDB9.dummy_user_token';
const mockAdminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFkbWluVXNlcklkIiwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxNzAwMDE3MjAwfQ.dummy_admin_token';
const mockInstructorToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Imluc3RydWN0b3JJZDEyMyIsImVtYWlsIjoiaW5zdHJ1Y3RvckBleGFtcGxlLmNvbSIsInJvbGUiOiJJTlNUUlVDVE9SIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMTcyMDB9.dummy_instructor_token';

describe('Users Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /users/me', () => {
    it('should return the authenticated user's profile', async () => {
      const mockUser = { id: 'userId123', email: 'user@example.com', username: 'testuser', profile: null };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const response = await app.handle(
        new Request('http://localhost/users/me', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${mockUserToken}`,
          },
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe('userId123');
      expect(body.email).toBe('user@example.com');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'userId123' }, include: { profile: true } });
    });

    it('should return 401 if not authenticated', async () => {
      const response = await app.handle(
        new Request('http://localhost/users/me', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(401);
    });
  });

  describe('GET /users/:id', () => {
    it('should return a user's profile by ID', async () => {
      const mockUser = { id: 'user456', email: 'other@example.com', username: 'otheruser', profile: null };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const response = await app.handle(
        new Request('http://localhost/users/user456', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe('user456');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user456' }, include: { profile: true } });
    });

    it('should return 404 if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await app.handle(
        new Request('http://localhost/users/nonexistent', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /users/me/profile', () => {
    it('should update the authenticated user's profile', async () => {
      const profileData = {
        firstName: 'John',
        lastName: 'Doe',
        bio: 'A test user',
      };
      mockPrisma.userProfile.upsert.mockResolvedValue({ userId: 'userId123', ...profileData });

      const response = await app.handle(
        new Request('http://localhost/users/me/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockUserToken}`,
          },
          body: JSON.stringify(profileData),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.firstName).toBe('John');
      expect(mockPrisma.userProfile.upsert).toHaveBeenCalledWith({
        where: { userId: 'userId123' },
        update: profileData,
        create: { userId: 'userId123', ...profileData },
      });
    });

    it('should return 401 if not authenticated', async () => {
      const profileData = {
        firstName: 'John',
      };

      const response = await app.handle(
        new Request('http://localhost/users/me/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profileData),
        })
      );

      expect(response.status).toBe(401);
    });
  });
});