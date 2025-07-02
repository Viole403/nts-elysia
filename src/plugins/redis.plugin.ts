import { Elysia } from 'elysia';
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisPublisher = new Redis(redisUrl);
export const redisSubscriber = new Redis(redisUrl);

redisPublisher.on('connect', () => console.log('Redis Publisher connected'));
redisPublisher.on('error', (err: any) => console.error('Redis Publisher Error', err));

redisSubscriber.on('connect', () => console.log('Redis Subscriber connected'));
redisSubscriber.on('error', (err: any) => console.error('Redis Subscriber Error', err));

export const redisPlugin = new Elysia()
  .decorate('redisPublisher', redisPublisher)
  .decorate('redisSubscriber', redisSubscriber);

export type RedisPlugin = typeof redisPlugin;