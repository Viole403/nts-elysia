import { t } from 'elysia';
import { EventType, EventStatus } from '@prisma/client';

export const createEventSchema = t.Object({
  title: t.String(),
  description: t.String(),
  startTime: t.Date(),
  endTime: t.Date(),
  location: t.String(),
  organizerId: t.String(),
  type: t.Enum(EventType),
});

export const updateEventSchema = t.Object({
  title: t.Optional(t.String()),
  description: t.Optional(t.String()),
  startTime: t.Optional(t.Date()),
  endTime: t.Optional(t.Date()),
  location: t.Optional(t.String()),
  type: t.Optional(t.Enum(EventType)),
  status: t.Optional(t.Enum(EventStatus)),
});

export const getEventsQuerySchema = t.Object({
  type: t.Optional(t.Enum(EventType)),
  status: t.Optional(t.Enum(EventStatus)),
  organizerId: t.Optional(t.String()),
  // time range filters can be added here if needed
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});
