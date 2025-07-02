import { prisma } from '../../lib/prisma';
import { EventType, EventStatus } from '@prisma/client';

export class EventService {
  static async create(data: { title: string; description: string; startTime: Date; endTime: Date; location: string; organizerId: string; type: EventType }) {
    return prisma.event.create({
      data,
    });
  }

  static async findAll(filters: { type?: EventType; status?: EventStatus; organizerId?: string }, page: number = 1, limit: number = 10) {
    const where: any = {};
    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.organizerId) {
      where.organizerId = filters.organizerId;
    }

    const skip = (page - 1) * limit;

    const events = await prisma.event.findMany({
      where,
      skip,
      take: limit,
      orderBy: { startTime: 'asc' },
    });
    const total = await prisma.event.count({ where });
    return { events, total, page, limit };
  }

  static async findOne(id: string) {
    return prisma.event.findUnique({
      where: { id },
    });
  }

  static async update(id: string, data: any) {
    return prisma.event.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string) {
    return prisma.event.delete({
      where: { id },
    });
  }

  static async attendEvent(eventId: string, userId: string) {
    // This assumes an EventAttendance model in Prisma, which is not in the provided schema.
    // For now, we'll just log the attendance conceptually.
    console.log(`User ${userId} is attending event ${eventId}`);
    // In a real application, you would create a record in a many-to-many table
    // e.g., prisma.eventAttendance.create({ data: { eventId, userId } });
    return { message: 'Attendance recorded conceptually.' };
  }
}
