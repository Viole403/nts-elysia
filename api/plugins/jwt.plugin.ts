import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { UserRole } from '@prisma/client';

interface AuthJWTPayload {
  id: string;
  email: string;
  role: UserRole;
}

export const jwtPlugin = new Elysia()
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'supersecret',
      // You can add more options here, like expiration time
    })
  )
  .decorate('verifyAndDecodeJwt', async function (this: any, token: string) {
    try {
      const decoded = await this.jwt.verify(token);
      if (typeof decoded === 'object' && decoded !== null && 'id' in decoded && 'email' in decoded && 'role' in decoded) {
        return decoded as AuthJWTPayload;
      }
      return null;
    } catch (error) {
      console.error('JWT verification failed:', error);
      return null;
    }
  });

export type JWTPlugin = typeof jwtPlugin;
