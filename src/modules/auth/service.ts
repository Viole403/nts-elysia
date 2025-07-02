import { prisma } from '../../lib/prisma';
import { sign } from 'jsonwebtoken';
import { AuthProvider, UserRole } from '@prisma/client';
import { emailService } from '../../services/email.service';
import { hashPassword, comparePassword } from '../../utils/auth';

const generateTokens = (userId: string, userEmail: string, userRole: UserRole) => {
  const accessToken = sign({ id: userId, email: userEmail, role: userRole }, process.env.JWT_SECRET || 'supersecret', {
    expiresIn: '15m',
  });
  const refreshToken = sign({ id: userId, email: userEmail, role: userRole }, process.env.JWT_REFRESH_SECRET || 'refreshsecret', {
    expiresIn: '7d',
  });
  return { accessToken, refreshToken };
};

export class AuthService {
  static async register(data: any) {
    const { username, email, password } = data;
    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role: UserRole.USER,
        provider: AuthProvider.EMAIL,
      },
    });
    const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role);
    await prisma.authSession.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    await emailService.sendWelcomeEmail(user.email, user.username || user.email);

    return { user: { id: user.id, email: user.email, username: user.username, role: user.role }, accessToken, refreshToken };
  }

  static async login(data: any) {
    const { email, password } = data;
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role);
    await prisma.authSession.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return { user: { id: user.id, email: user.email, username: user.username, role: user.role }, accessToken, refreshToken };
  }

  static async refreshToken(oldRefreshToken: string) {
    const session = await prisma.authSession.findUnique({
      where: { token: oldRefreshToken },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new Error('Invalid or expired refresh token');
    }

    const { accessToken, refreshToken } = generateTokens(session.userId, session.user.email, session.user.role);
    await prisma.authSession.update({
      where: { id: session.id },
      data: {
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  static async logout(refreshToken: string) {
    await prisma.authSession.deleteMany({
      where: { token: refreshToken },
    });
    return { message: 'Logged out successfully' };
  }

  static async socialLogin(provider: 'google' | 'apple', tokens: any) {
    // In a real application, you would use the tokens to fetch user info from the social provider
    // For now, we'll use placeholder data
    const email = `${provider}_user@example.com`; // Replace with actual email from social provider
    const username = `${provider}_user`; // Replace with actual username from social provider

    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          username,
          password: '', // Social logins don't have a password
          provider: provider === 'google' ? AuthProvider.GOOGLE : AuthProvider.APPLE,
          providerId: tokens.id_token || tokens.access_token, // Use appropriate ID from tokens
        },
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role);
    await prisma.authSession.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return { user: { id: user.id, email: user.email, username: user.username, role: user.role }, accessToken, refreshToken };
  }
}
