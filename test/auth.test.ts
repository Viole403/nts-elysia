import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import app from '../src/index';
import { prisma } from '../src/lib/prisma';
import { emailService } from '../src/services/email.service';
import { hashPassword } from '../src/utils/auth';

// Mock Prisma and EmailService
const mockPrisma = { 
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  authSession: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const mockEmailService = {
  sendWelcomeEmail: jest.fn(),
};

// Replace actual imports with mocks
// This is a simplified mocking approach. For more complex scenarios, consider a dedicated mocking library or dependency injection.
// @ts-ignore
prisma = mockPrisma;
// @ts-ignore
emailService = mockEmailService;

describe('Auth Module', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const newUser = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      };
      const hashedPassword = await hashPassword(newUser.password);

      mockPrisma.user.create.mockResolvedValue({
        id: 'user1',
        ...newUser,
        password: hashedPassword,
        role: 'USER',
        provider: 'EMAIL',
      });
      mockPrisma.authSession.create.mockResolvedValue({});
      mockEmailService.sendWelcomeEmail.mockResolvedValue({});

      const response = await app.handle(
        new Request('http://localhost/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newUser),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.user).toBeDefined();
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          username: newUser.username,
          email: newUser.email,
          password: expect.any(String),
          role: 'USER',
          provider: 'EMAIL',
        },
      });
      expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith(newUser.email, newUser.username);
    });

    it('should return 400 if email already exists', async () => {
      const existingUser = {
        username: 'existinguser',
        email: 'existing@example.com',
        password: 'password123',
      };

      mockPrisma.user.create.mockRejectedValue(new Error('Unique constraint failed on the fields: (`email`)'));

      const response = await app.handle(
        new Request('http://localhost/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(existingUser),
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.message).toContain('Unique constraint failed');
    });
  });

  describe('POST /auth/login', () => {
    it('should log in a user successfully', async () => {
      const userCredentials = {
        email: 'test@example.com',
        password: 'password123',
      };
      const hashedPassword = await hashPassword(userCredentials.password);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user1',
        email: userCredentials.email,
        password: hashedPassword,
        role: 'USER',
      });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.authSession.create.mockResolvedValue({});

      const response = await app.handle(
        new Request('http://localhost/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userCredentials),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.user).toBeDefined();
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { email: userCredentials.email } });
    });

    it('should return 401 for invalid credentials', async () => {
      const userCredentials = {
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
      };

      mockPrisma.user.findUnique.mockResolvedValue(null); // User not found

      const response = await app.handle(
        new Request('http://localhost/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userCredentials),
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.message).toBe('Invalid credentials');
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh token successfully', async () => {
      const oldRefreshToken = 'old_refresh_token';
      const userId = 'user1';
      const userEmail = 'test@example.com';
      const userRole = 'USER';

      mockPrisma.authSession.findUnique.mockResolvedValue({
        id: 'session1',
        userId,
        token: oldRefreshToken,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour from now
        user: { id: userId, email: userEmail, role: userRole },
      });
      mockPrisma.authSession.update.mockResolvedValue({});

      const response = await app.handle(
        new Request('http://localhost/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: oldRefreshToken }),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(mockPrisma.authSession.findUnique).toHaveBeenCalledWith({ where: { token: oldRefreshToken } });
    });

    it('should return 401 for invalid or expired refresh token', async () => {
      const invalidRefreshToken = 'invalid_token';

      mockPrisma.authSession.findUnique.mockResolvedValue(null); // Invalid token

      const response = await app.handle(
        new Request('http://localhost/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: invalidRefreshToken }),
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.message).toBe('Invalid or expired refresh token');
    });
  });

  describe('POST /auth/logout', () => {
    it('should log out a user successfully', async () => {
      const refreshToken = 'valid_refresh_token';

      mockPrisma.authSession.deleteMany.mockResolvedValue({});

      const response = await app.handle(
        new Request('http://localhost/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.message).toBe('Logged out successfully');
      expect(mockPrisma.authSession.deleteMany).toHaveBeenCalledWith({ where: { token: refreshToken } });
    });
  });
});