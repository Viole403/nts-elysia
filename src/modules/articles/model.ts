import { t } from 'elysia';
import { ArticleStatus } from '@prisma/client';

export const createArticleSchema = t.Object({
  title: t.String(),
  content: t.String(),
  authorId: t.String(),
});

export const updateArticleSchema = t.Object({
  title: t.Optional(t.String()),
  content: t.Optional(t.String()),
  status: t.Optional(t.Enum(ArticleStatus)),
});

export const getArticlesQuerySchema = t.Object({
  status: t.Optional(t.Enum(ArticleStatus)),
  authorId: t.Optional(t.String()),
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});
