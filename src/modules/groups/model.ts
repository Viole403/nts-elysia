import { t } from 'elysia';
import { GroupVisibility, GroupMemberRole } from '@prisma/client';

export const createGroupSchema = t.Object({
  name: t.String(),
  description: t.Optional(t.String()),
  visibility: t.Optional(t.Enum(GroupVisibility)),
});

export const updateGroupSchema = t.Object({
  name: t.Optional(t.String()),
  description: t.Optional(t.String()),
  visibility: t.Optional(t.Enum(GroupVisibility)),
});

export const getGroupsQuerySchema = t.Object({
  visibility: t.Optional(t.Enum(GroupVisibility)),
  creatorId: t.Optional(t.String()), // Assuming a creatorId field in Group model
});

export const updateGroupMemberRoleSchema = t.Object({
  role: t.Enum(GroupMemberRole), // Corrected to use enum
});

// Group Post Schemas
export const createGroupPostSchema = t.Object({
  content: t.String(),
});

export const updateGroupPostSchema = t.Object({
  content: t.Optional(t.String()),
});

export const getGroupPostsQuerySchema = t.Object({
  authorId: t.Optional(t.String()),
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});