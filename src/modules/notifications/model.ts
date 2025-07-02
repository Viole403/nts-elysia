import { t } from 'elysia';

export const getNotificationsQuerySchema = t.Object({
  isRead: t.Optional(t.Boolean()),
});
