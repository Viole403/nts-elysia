import { t } from 'elysia';
import { CommentableType, VoteType } from '@prisma/client';

export const createCommentSchema = t.Object({
  content: t.String(),
  parentId: t.Optional(t.String()),
});

export const updateCommentSchema = t.Object({
  content: t.String(),
});

export const commentVoteSchema = t.Object({
  voteType: t.Enum(VoteType),
});

export const getCommentsQuerySchema = t.Object({
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
  sortBy: t.Optional(t.String()),
  sortOrder: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')])),
});
