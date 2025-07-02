import { t } from 'elysia';
import { ShopItemStatus } from '@prisma/client';

export const createShopItemSchema = t.Object({
  name: t.String(),
  description: t.String(),
  price: t.Numeric(),
  stock: t.Numeric(),
});

export const updateShopItemSchema = t.Object({
  name: t.Optional(t.String()),
  description: t.Optional(t.String()),
  price: t.Optional(t.Numeric()),
  stock: t.Optional(t.Numeric()),
  status: t.Optional(t.Enum(ShopItemStatus)),
});

export const getShopItemsQuerySchema = t.Object({
  sellerId: t.Optional(t.String()),
  status: t.Optional(t.Enum(ShopItemStatus)),
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});
