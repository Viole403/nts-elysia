import { prisma } from '../../lib/prisma';
import { CourseLevel, CourseStatus, PaymentType, PaymentEntityType, PaymentGateway } from '@prisma/client';
import { PaymentService } from '../../modules/payments/service';

export class CourseService {
  static async create(data: { title: string; description: string; instructorId: string; level: CourseLevel; price: number }) {
    return prisma.course.create({
      data,
    });
  }

  static async findAll(filters: { level?: CourseLevel; instructorId?: string; status?: CourseStatus }, page: number = 1, limit: number = 10) {
    const where: any = {};
    if (filters.level) {
      where.level = filters.level;
    }
    if (filters.instructorId) {
      where.instructorId = filters.instructorId;
    }
    if (filters.status) {
      where.status = filters.status;
    }

    const skip = (page - 1) * limit;

    const courses = await prisma.course.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    const total = await prisma.course.count({ where });
    return { courses, total, page, limit };
  }

  static async findOne(id: string) {
    return prisma.course.findUnique({
      where: { id },
    });
  }

  static async update(id: string, data: any) {
    return prisma.course.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string) {
    return prisma.course.delete({
      where: { id },
    });
  }

  static async enrollCourse(courseId: string, userId: string, paymentGateway: PaymentGateway) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new Error('Course not found');
    }

    // Create a payment record for course enrollment
    const payment = await PaymentService.create({
      userId,
      amount: course.price,
      paymentType: PaymentType.COURSE_PURCHASE,
      entityId: courseId,
      entityType: PaymentEntityType.COURSE,
      paymentGateway,
    });

    // In a real application, you would mark the user as enrolled only after successful payment confirmation
    // For now, we'll return the payment details

    return payment;
  }
}
