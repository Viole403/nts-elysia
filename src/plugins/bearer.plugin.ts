import { Elysia } from 'elysia';
import { bearer } from '@elysiajs/bearer';

export const bearerPlugin = new Elysia().use(bearer());

export type BearerPlugin = typeof bearerPlugin;
