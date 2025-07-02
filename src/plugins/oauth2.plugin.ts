import { oauth2 } from 'elysia-oauth2';
import { Elysia } from 'elysia';

export const oauth2Plugin = new Elysia().use(
  oauth2({
    Google: [
      process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
      process.env.GOOGLE_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET',
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
    ],
    Apple: [
      process.env.APPLE_CLIENT_ID || 'YOUR_APPLE_CLIENT_ID',
      process.env.APPLE_TEAM_ID || 'YOUR_APPLE_TEAM_ID',
      process.env.APPLE_KEY_ID || 'YOUR_APPLE_KEY_ID',
      new TextEncoder().encode(process.env.APPLE_PRIVATE_KEY || 'YOUR_APPLE_PRIVATE_KEY'),
      process.env.APPLE_REDIRECT_URI || 'http://localhost:3000/auth/apple/callback',
    ],
  })
);

export type OAuth2Plugin = typeof oauth2Plugin;
