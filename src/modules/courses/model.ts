import { t } from 'elysia';
import { CourseLevel, CourseStatus } from '@prisma/client';

export const createCourseSchema = t.Object({
  title: t.String(),
  description: t.String(),
  instructorId: t.String(),
  level: t.Enum(CourseLevel),
  price: t.Numeric(),
});

export const updateCourseSchema = t.Object({
  title: t.Optional(t.String()),
  description: t.Optional(t.String()),
  level: t.Optional(t.Enum(CourseLevel)),
  price: t.Optional(t.Numeric()),
  status: t.Optional(t.Enum(CourseStatus)),
});

export const getCoursesQuerySchema = t.Object({
  level: t.Optional(t.Enum(CourseLevel)),
  instructorId: t.Optional(t.String()),
  status: t.Optional(t.Enum(CourseStatus)),
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});
