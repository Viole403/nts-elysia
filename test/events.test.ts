import { describe, expect, it, beforeEach } from 'bun:test';
import app from '../src/index';
import { prisma } from '../src/lib/prisma';
import { EventStatus, EventType, UserRole } from '@prisma/client';

// Mock Prisma
const mockPrisma = {
  event: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

// Replace actual imports with mocks
// @ts-ignore
prisma = mockPrisma;

const mockUserToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXJJZDEyMyIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsInJvbGUiOiJVU0VSIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMTcyMDB9.dummy_user_token';
const mockAdminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFkbWluVXNlcklkIiwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxNzAwMDE3MjAwfQ.dummy_admin_token';

describe('Events Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /events', () => {
    it('should create a new event successfully', async () => {
      const newEvent = {
        title: 'Community Meetup',
        description: 'A casual meetup for developers.',
        startTime: new Date('2025-01-01T10:00:00Z'),
        endTime: new Date('2025-01-01T12:00:00Z'),
        location: 'Online',
        organizerId: 'userId123',
        type: EventType.ONLINE,
      };

      mockPrisma.event.create.mockResolvedValue({
        id: 'event1',
        ...newEvent,
        status: EventStatus.UPCOMING,
      });

      const response = await app.handle(
        new Request('http://localhost/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockUserToken}`,
          },
          body: JSON.stringify(newEvent),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.title).toBe(newEvent.title);
      expect(mockPrisma.event.create).toHaveBeenCalledWith({
        data: newEvent,
      });
    });

    it('should return 401 if not authenticated', async () => {
      const newEvent = {
        title: 'Community Meetup',
        description: 'A casual meetup for developers.',
        startTime: new Date('2025-01-01T10:00:00Z'),
        endTime: new Date('2025-01-01T12:00:00Z'),
        location: 'Online',
        organizerId: 'userId123',
        type: EventType.ONLINE,
      };

      const response = await app.handle(
        new Request('http://localhost/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newEvent),
        })
      );

      expect(response.status).toBe(401);
    });
  });

  describe('GET /events', () => {
    it('should return a list of events', async () => {
      const mockEvents = [
        { id: 'e1', title: 'Event 1', type: EventType.ONLINE, organizerId: 'org1' },
        { id: 'e2', title: 'Event 2', type: EventType.IN_PERSON, organizerId: 'org2' },
      ];
      mockPrisma.event.findMany.mockResolvedValue(mockEvents);
      mockPrisma.event.count.mockResolvedValue(2);

      const response = await app.handle(
        new Request('http://localhost/events', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.events).toEqual(mockEvents);
      expect(body.total).toBe(2);
    });
  });

  describe('GET /events/:id', () => {
    it('should return a single event', async () => {
      const mockEvent = { id: 'e1', title: 'Event 1', type: EventType.ONLINE, organizerId: 'org1' };
      mockPrisma.event.findUnique.mockResolvedValue(mockEvent);

      const response = await app.handle(
        new Request('http://localhost/events/e1', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.title).toBe('Event 1');
      expect(mockPrisma.event.findUnique).toHaveBeenCalledWith({ where: { id: 'e1' } });
    });

    it('should return 404 if event not found', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);

      const response = await app.handle(
        new Request('http://localhost/events/non-existent-event', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /events/:id', () => {
    it('should update an event successfully by organizer', async () => {
      const eventId = 'event1';
      const existingEvent = { id: eventId, title: 'Old Title', organizerId: 'userId123', type: EventType.ONLINE };
      const updatedData = { title: 'New Title', location: 'Zoom' };

      mockPrisma.event.findUnique.mockResolvedValue(existingEvent);
      mockPrisma.event.update.mockResolvedValue({ ...existingEvent, ...updatedData });

      const response = await app.handle(
        new Request(`http://localhost/events/${eventId}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mockUserToken}`,
            },
            body: JSON.stringify(updatedData),
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.title).toBe('New Title');
      expect(body.location).toBe('Zoom');
      expect(mockPrisma.event.update).toHaveBeenCalledWith({
        where: { id: eventId },
        data: updatedData,
      });
    });

    it('should return 403 if user is not organizer or admin', async () => {
      const eventId = 'event1';
      const existingEvent = { id: eventId, title: 'Old Title', organizerId: 'otherOrganizer', type: EventType.ONLINE };
      const updatedData = { title: 'New Title' };

      mockPrisma.event.findUnique.mockResolvedValue(existingEvent);

      const response = await app.handle(
        new Request(`http://localhost/events/${eventId}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mockUserToken}`,
            },
            body: JSON.stringify(updatedData),
          })
      );

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /events/:id', () => {
    it('should delete an event successfully by organizer', async () => {
      const eventId = 'event1';
      const existingEvent = { id: eventId, title: 'Event to Delete', organizerId: 'userId123' };

      mockPrisma.event.findUnique.mockResolvedValue(existingEvent);
      mockPrisma.event.delete.mockResolvedValue(existingEvent);

      const response = await app.handle(
        new Request(`http://localhost/events/${eventId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${mockUserToken}`,
            },
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe(eventId);
      expect(mockPrisma.event.delete).toHaveBeenCalledWith({ where: { id: eventId } });
    });

    it('should return 403 if user is not organizer or admin', async () => {
      const eventId = 'event1';
      const existingEvent = { id: eventId, title: 'Event to Delete', organizerId: 'otherOrganizer', type: EventType.ONLINE };

      mockPrisma.event.findUnique.mockResolvedValue(existingEvent);

      const response = await app.handle(
        new Request(`http://localhost/events/${eventId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${mockUserToken}`,
            },
          })
      );

      expect(response.status).toBe(403);
    });
  });

  describe('POST /events/:id/attend', () => {
    it('should conceptually record attendance successfully', async () => {
      const eventId = 'event1';
      const mockEvent = { id: eventId, title: 'Test Event' };

      mockPrisma.event.findUnique.mockResolvedValue(mockEvent);

      const response = await app.handle(
        new Request(`http://localhost/events/${eventId}/attend`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${mockUserToken}`,
            },
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.message).toBe('Attendance recorded conceptually.');
    });

    it('should return 404 if event not found for attendance', async () => {
      const eventId = 'nonexistent_event';

      mockPrisma.event.findUnique.mockResolvedValue(null);

      const response = await app.handle(
        new Request(`http://localhost/events/${eventId}/attend`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${mockUserToken}`,
            },
          })
      );

      expect(response.status).toBe(404);
    });

    it('should return 401 if not authenticated for attendance', async () => {
      const eventId = 'event1';

      const response = await app.handle(
        new Request(`http://localhost/events/${eventId}/attend`,
          {
            method: 'POST',
          })
      );

      expect(response.status).toBe(401);
    });
  });
});