import { describe, expect, it, beforeEach } from 'bun:test';
import app from '../src/index';
import { prisma } from '../src/lib/prisma';
import { CourseLevel, CourseStatus, PaymentGateway, UserRole } from '@prisma/client';

// Mock Prisma
const mockPrisma = {
  course: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

// Mock PaymentService (since it's used in enrollCourse)
const mockPaymentService = {
  create: jest.fn(),
};

// Replace actual imports with mocks
// @ts-ignore
prisma = mockPrisma;
// @ts-ignore
// Mocking PaymentService directly in the test file for simplicity
// In a real app, you might want to mock the entire module or use a DI container
const PaymentService = mockPaymentService;

const mockInstructorToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Imluc3RydWN0b3JJZDEyMyIsImVtYWlsIjoiaW5zdHJ1Y3RvckBleGFtcGxlLmNvbSIsInJvbGUiOiJJTlNUUlVDVE9SIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMTcyMDB9.dummy_instructor_token';
const mockUserToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXJJZDEyMyIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsInJvbGUiOiJVU0VSIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMTcyMDB9.dummy_user_token';
const mockAdminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFkbWluVXNlcklkIiwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxNzAwMDE3MjAwfQ.dummy_admin_token';

describe('Courses Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /courses', () => {
    it('should create a new course successfully', async () => {
      const newCourse = {
        title: 'Introduction to Programming',
        description: 'Learn the basics of programming.',
        instructorId: 'instructorId123',
        level: CourseLevel.BEGINNER,
        price: 99.99,
      };

      mockPrisma.course.create.mockResolvedValue({
        id: 'course1',
        ...newCourse,
        status: CourseStatus.DRAFT,
      });

      const response = await app.handle(
        new Request('http://localhost/courses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockInstructorToken}`,
          },
          body: JSON.stringify(newCourse),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.title).toBe(newCourse.title);
      expect(mockPrisma.course.create).toHaveBeenCalledWith({
        data: newCourse,
      });
    });

    it('should return 401 if not authenticated', async () => {
      const newCourse = {
        title: 'Introduction to Programming',
        description: 'Learn the basics of programming.',
        instructorId: 'instructorId123',
        level: CourseLevel.BEGINNER,
        price: 99.99,
      };

      const response = await app.handle(
        new Request('http://localhost/courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newCourse),
        })
      );

      expect(response.status).toBe(401);
    });

    it('should return 403 if user does not have INSTRUCTOR or ADMIN role', async () => {
      const newCourse = {
        title: 'Introduction to Programming',
        description: 'Learn the basics of programming.',
        instructorId: 'userId123',
        level: CourseLevel.BEGINNER,
        price: 99.99,
      };

      const response = await app.handle(
        new Request('http://localhost/courses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockUserToken}`,
          },
          body: JSON.stringify(newCourse),
        })
      );

      expect(response.status).toBe(403);
    });
  });

  describe('GET /courses', () => {
    it('should return a list of courses', async () => {
      const mockCourses = [
        { id: 'c1', title: 'Course 1', level: CourseLevel.BEGINNER, instructorId: 'inst1' },
        { id: 'c2', title: 'Course 2', level: CourseLevel.ADVANCED, instructorId: 'inst2' },
      ];
      mockPrisma.course.findMany.mockResolvedValue(mockCourses);
      mockPrisma.course.count.mockResolvedValue(2);

      const response = await app.handle(
        new Request('http://localhost/courses', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.courses).toEqual(mockCourses);
      expect(body.total).toBe(2);
    });
  });

  describe('GET /courses/:id', () => {
    it('should return a single course', async () => {
      const mockCourse = { id: 'c1', title: 'Course 1', level: CourseLevel.BEGINNER, instructorId: 'inst1' };
      mockPrisma.course.findUnique.mockResolvedValue(mockCourse);

      const response = await app.handle(
        new Request('http://localhost/courses/c1', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.title).toBe('Course 1');
      expect(mockPrisma.course.findUnique).toHaveBeenCalledWith({ where: { id: 'c1' } });
    });

    it('should return 404 if course not found', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);

      const response = await app.handle(
        new Request('http://localhost/courses/non-existent-course', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /courses/:id', () => {
    it('should update a course successfully by instructor', async () => {
      const courseId = 'course1';
      const existingCourse = { id: courseId, title: 'Old Title', instructorId: 'instructorId123', level: CourseLevel.BEGINNER, price: 50 };
      const updatedData = { title: 'New Title', price: 120.50 };

      mockPrisma.course.findUnique.mockResolvedValue(existingCourse);
      mockPrisma.course.update.mockResolvedValue({ ...existingCourse, ...updatedData });

      const response = await app.handle(
        new Request(`http://localhost/courses/${courseId}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mockInstructorToken}`,
            },
            body: JSON.stringify(updatedData),
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.title).toBe('New Title');
      expect(body.price).toBe(120.50);
      expect(mockPrisma.course.update).toHaveBeenCalledWith({
        where: { id: courseId },
        data: updatedData,
      });
    });

    it('should return 403 if user is not instructor or admin', async () => {
      const courseId = 'course1';
      const existingCourse = { id: courseId, title: 'Old Title', instructorId: 'otherInstructor', level: CourseLevel.BEGINNER, price: 50 };
      const updatedData = { title: 'New Title' };

      mockPrisma.course.findUnique.mockResolvedValue(existingCourse);

      const response = await app.handle(
        new Request(`http://localhost/courses/${courseId}`,
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

  describe('DELETE /courses/:id', () => {
    it('should delete a course successfully by instructor', async () => {
      const courseId = 'course1';
      const existingCourse = { id: courseId, title: 'Course to Delete', instructorId: 'instructorId123' };

      mockPrisma.course.findUnique.mockResolvedValue(existingCourse);
      mockPrisma.course.delete.mockResolvedValue(existingCourse);

      const response = await app.handle(
        new Request(`http://localhost/courses/${courseId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${mockInstructorToken}`,
            },
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe(courseId);
      expect(mockPrisma.course.delete).toHaveBeenCalledWith({ where: { id: courseId } });
    });

    it('should return 403 if user is not instructor or admin', async () => {
      const courseId = 'course1';
      const existingCourse = { id: courseId, title: 'Course to Delete', instructorId: 'otherInstructor' };

      mockPrisma.course.findUnique.mockResolvedValue(existingCourse);

      const response = await app.handle(
        new Request(`http://localhost/courses/${courseId}`,
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

  describe('POST /courses/:id/enroll', () => {
    it('should enroll in a course successfully', async () => {
      const courseId = 'course1';
      const mockCourse = { id: courseId, title: 'Test Course', price: 100 };
      const mockPayment = { id: 'payment1', amount: 100, status: 'PENDING' };

      mockPrisma.course.findUnique.mockResolvedValue(mockCourse);
      mockPaymentService.create.mockResolvedValue(mockPayment);

      const response = await app.handle(
        new Request(`http://localhost/courses/${courseId}/enroll`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mockUserToken}`,
            },
            body: JSON.stringify({ paymentGateway: PaymentGateway.STRIPE }),
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe('payment1');
      expect(mockPaymentService.create).toHaveBeenCalledWith({
        userId: 'userId123',
        amount: mockCourse.price,
        paymentType: 'COURSE_PURCHASE',
        entityId: courseId,
        entityType: 'COURSE',
        paymentGateway: PaymentGateway.STRIPE,
      });
    });

    it('should return 404 if course not found for enrollment', async () => {
      const courseId = 'nonexistent_course';

      mockPrisma.course.findUnique.mockResolvedValue(null);

      const response = await app.handle(
        new Request(`http://localhost/courses/${courseId}/enroll`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mockUserToken}`,
            },
            body: JSON.stringify({ paymentGateway: PaymentGateway.STRIPE }),
          })
      );

      expect(response.status).toBe(404);
    });

    it('should return 401 if not authenticated for enrollment', async () => {
      const courseId = 'course1';

      const response = await app.handle(
        new Request(`http://localhost/courses/${courseId}/enroll`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentGateway: PaymentGateway.STRIPE }),
          })
      );

      expect(response.status).toBe(401);
    });
  });
});