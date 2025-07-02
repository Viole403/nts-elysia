import { t } from 'elysia';

export const userProfileSchema = t.Object({
  firstName: t.String(),
  lastName: t.String(),
  bio: t.Optional(t.String()),
  avatarUrl: t.Optional(t.String()),
  websiteUrl: t.Optional(t.String()),
  linkedinUrl: t.Optional(t.String()),
  githubUrl: t.Optional(t.String()),
});

export const updateUserProfileSchema = t.Object({
  firstName: t.Optional(t.String()),
  lastName: t.Optional(t.String()),
  bio: t.Optional(t.String()),
  avatarUrl: t.Optional(t.String()),
  websiteUrl: t.Optional(t.String()),
  linkedinUrl: t.Optional(t.String()),
  githubUrl: t.Optional(t.String()),
});
