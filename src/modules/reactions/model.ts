import { t } from 'elysia';
import { ReactableType, ReactionType } from '@prisma/client';

export const createReactionSchema = t.Object({
  reactionType: t.Enum(ReactionType),
});
