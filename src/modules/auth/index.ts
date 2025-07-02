import { Elysia, Context } from 'elysia';
import { AuthService } from './service';
import { registerSchema, loginSchema, refreshTokenSchema } from './model';
import { oauth2Plugin } from '../../plugins/oauth2.plugin';
import { authPlugin } from '../../plugins/auth.plugin';

export class AuthController {
  static async register(ctx: Context) {
    return AuthService.register(ctx.body);
  }

  static async login(ctx: Context) {
    return AuthService.login(ctx.body);
  }

  static async refreshToken(ctx: Context) {
    return AuthService.refreshToken(ctx.body.refreshToken);
  }

  static async logout(ctx: Context) {
    return AuthService.logout(ctx.body.refreshToken);
  }

  static async googleAuth(ctx: Context) {
    ctx.set.redirect = await ctx.oauth2.google();
  }

  static async googleCallback(ctx: Context) {
    const tokens = await ctx.oauth2.google();
    return AuthService.socialLogin('google', tokens);
  }

  static async appleAuth(ctx: Context) {
    ctx.set.redirect = await ctx.oauth2.apple();
  }

  static async appleCallback(ctx: Context) {
    const tokens = await ctx.oauth2.apple();
    return AuthService.socialLogin('apple', tokens);
  }
}

export const authModule = new Elysia()
  .use(oauth2Plugin) // Use the oauth2 plugin here
  .group('/auth', (app) =>
    app
      .post('/register', AuthController.register, { body: registerSchema })
      .post('/login', AuthController.login, { body: loginSchema })
      .post('/refresh', AuthController.refreshToken, { body: refreshTokenSchema })
      .post('/logout', AuthController.logout, { body: refreshTokenSchema })
      .get('/google', AuthController.googleAuth)
      .get('/google/callback', AuthController.googleCallback)
      .get('/apple', AuthController.appleAuth)
      .post('/apple/callback', AuthController.appleCallback)
  );