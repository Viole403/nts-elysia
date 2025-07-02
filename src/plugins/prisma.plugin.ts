import { Elysia } from 'elysia';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export const prismaPlugin = new Elysia().decorate('prisma', prisma);

export type PrismaPlugin = typeof prismaPlugin;
