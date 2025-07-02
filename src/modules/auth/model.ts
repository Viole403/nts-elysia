import { t } from 'elysia';

export const registerSchema = t.Object({
  username: t.String(),
  email: t.String(),
  password: t.String(),
});

export const loginSchema = t.Object({
  email: t.String(),
  password: t.String(),
});

export const refreshTokenSchema = t.Object({
  refreshToken: t.String(),
});