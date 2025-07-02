import { Elysia } from 'elysia';
import { UserRole } from '@prisma/client';

// Define the user type that should be attached to context
interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

export const rbac = (allowedRoles: UserRole[]) => {
  return new Elysia().onBeforeHandle((ctx) => {
    // Access user property with proper type checking
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

    // Optionally, you can attach the user back to context for type safety in routes
    // This ensures the user is available in subsequent handlers
    return;
  });
};

// Alternative approach with better type safety using Elysia's derive
