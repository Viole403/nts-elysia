import { Elysia } from 'elysia';
import { Redis } from '@upstash/redis';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || 'http://localhost:8080';
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || 'your-token';

export const redis = new Redis({
  url: redisUrl,
  token: redisToken,
});

export const redisPlugin = new Elysia().decorate('redis', redis);

export type RedisPlugin = typeof redisPlugin;
