import { Elysia, Context } from 'elysia';
import { UserService } from './service';
import { updateUserProfileSchema } from './model';
import { authPlugin, rbac } from '../../plugins/auth.plugin';
import { UserRole } from '@prisma/client';

export class UserController {
  static async getMe(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized' };
    }
    return UserService.findUserById(ctx.user.id);
  }

  static async getUserById(ctx: Context) {
    return UserService.findUserById(ctx.params.id);
  }

  static async updateMyProfile(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized' };
    }
    return UserService.updateProfile(ctx.user.id, ctx.body);
  }
}

export const userModule = new Elysia()
  .use(authPlugin) // Ensure authPlugin is used to populate ctx.user
  .group('/users', (app) =>
    app
      .get('/me', UserController.getMe, {
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.INSTRUCTOR])],
      })
      .get('/:id', UserController.getUserById) // Public route
      .put('/me/profile', UserController.updateMyProfile, {
        body: updateUserProfileSchema,
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN, UserRole.MODERATOR, UserRole.INSTRUCTOR])],
      })
  );