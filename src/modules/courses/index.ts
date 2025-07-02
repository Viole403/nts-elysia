import { Elysia, Context, t } from 'elysia';
import { CourseService } from './service';
import { createCourseSchema, updateCourseSchema, getCoursesQuerySchema } from './model';
import { authPlugin, rbac } from '../../plugins/auth.plugin';
import { CourseLevel, CourseStatus, PaymentGateway, UserRole } from '@prisma/client';

export class CourseController {
  static async create(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    return CourseService.create({ ...ctx.body, instructorId: ctx.user.id });
  }

  static async findAll(ctx: Context) {
    const { level, instructorId, status } = ctx.query;
    const filters = { level: level as CourseLevel, instructorId, status: status as CourseStatus };
    return CourseService.findAll(filters, page ? Number(page) : undefined, limit ? Number(limit) : undefined);
  }

  static async findOne(ctx: Context) {
    return CourseService.findOne(ctx.params.id);
  }

  static async update(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const course = await CourseService.findOne(ctx.params.id);
    if (!course) {
      ctx.set.status = 404;
      return { message: 'Course not found' };
    }
    // Only the instructor or an admin can update
    if (ctx.user.id !== course.instructorId && ctx.user.role !== UserRole.ADMIN) {
      ctx.set.status = 403;
      return { message: 'Forbidden: You can only update your own courses.' };
    }
    return CourseService.update(ctx.params.id, ctx.body);
  }

  static async delete(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const course = await CourseService.findOne(ctx.params.id);
    if (!course) {
      ctx.set.status = 404;
      return { message: 'Course not found' };
    }
    // Only the instructor or an admin can delete
    if (ctx.user.id !== course.instructorId && ctx.user.role !== UserRole.ADMIN) {
      ctx.set.status = 403;
      return { message: 'Forbidden: You can only delete your own courses.' };
    }
    return CourseService.delete(ctx.params.id);
  }

  static async enroll(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const { id } = ctx.params;
    const { paymentGateway } = ctx.body;
    return CourseService.enrollCourse(id, ctx.user.id, paymentGateway);
  }
}

export const courseModule = new Elysia()
  .use(authPlugin)
  .group('/courses', (app) =>
    app
      .post('/', CourseController.create, {
        body: createCourseSchema,
        beforeHandle: [rbac([UserRole.INSTRUCTOR, UserRole.ADMIN])],
      })
      .get('/', CourseController.findAll, { query: getCoursesQuerySchema })
      .get('/:id', CourseController.findOne)
      .put('/:id', CourseController.update, {
        body: updateCourseSchema,
        beforeHandle: [rbac([UserRole.INSTRUCTOR, UserRole.ADMIN])],
      })
      .delete('/:id', CourseController.delete, {
        beforeHandle: [rbac([UserRole.INSTRUCTOR, UserRole.ADMIN])],
      })
      .post('/:id/enroll', CourseController.enroll, {
        body: t.Object({
          paymentGateway: t.Enum(PaymentGateway),
        }),
        beforeHandle: [rbac([UserRole.USER])],
      })
  );
