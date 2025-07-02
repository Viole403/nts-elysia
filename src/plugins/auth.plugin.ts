import { Elysia, Context } from 'elysia';
import { UserRole } from '@prisma/client';
import { jwtPlugin } from './jwt.plugin';
import { bearerPlugin } from './bearer.plugin';

// Define the user type that should be attached to context
interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

export const authPlugin = new Elysia()
  .use(jwtPlugin)
  .use(bearerPlugin)
  .decorate('user', null as AuthenticatedUser | null) // Initialize user as null
  .onBeforeHandle(async (ctx) => {
    const { bearer, jwt, set } = ctx as any; // Use 'any' for now to bypass type checking issues with Elysia's context

    if (!bearer) {
      set.status = 401;
      return { message: 'Unauthorized: Bearer token missing.' };
    }

    try {
      const decodedUser = await jwt.verify(bearer);

      if (!decodedUser || typeof decodedUser !== 'object' || !('id' in decodedUser) || !('email' in decodedUser) || !('role' in decodedUser)) {
        set.status = 401;
        return { message: 'Unauthorized: Invalid token.' };
      }

      // Attach the decoded user to the context
      ctx.user = decodedUser as AuthenticatedUser;

    } catch (error) {
      console.error('Authentication failed:', error);
      set.status = 401;
      return { message: 'Unauthorized: Invalid or expired token.' };
    }
  });

export const rbac = (allowedRoles: UserRole[]) => {
  return (ctx: Context) => {
    const user = (ctx as any).user as AuthenticatedUser | undefined;

    if (!user) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }

    if (!user.role) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User role not found.' };
    }

    if (!allowedRoles.includes(user.role)) {
      ctx.set.status = 403;
      return { message: 'Forbidden: Insufficient permissions.' };
    }
  };
};