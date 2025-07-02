import { Elysia, Context, t } from 'elysia';
import { JobListingService } from './service';
import { createJobListingSchema, updateJobListingSchema, getJobListingsQuerySchema } from './model';
import { authPlugin, rbac } from '../../plugins/auth.plugin';
import { EmploymentType, JobStatus, UserRole } from '@prisma/client';

export class JobListingController {
  static async create(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    // Assuming 'CLIENT' role can post jobs, or ADMIN
    if (ctx.user.role !== UserRole.ADMIN && ctx.user.role !== UserRole.USER) { // Changed USER to CLIENT if that's the intended role
      ctx.set.status = 403;
      return { message: 'Forbidden: Only clients or admins can create job listings.' };
    }
    return JobListingService.create({ ...ctx.body, postedById: ctx.user.id });
  }

  static async findAll(ctx: Context) {
    const { employmentType, location, status, salaryMin, salaryMax } = ctx.query;
    const filters = { employmentType: employmentType as EmploymentType, location, status: status as JobStatus, salaryMin, salaryMax };
    return JobListingService.findAll(filters, page ? Number(page) : undefined, limit ? Number(limit) : undefined);
  }

  static async findOne(ctx: Context) {
    return JobListingService.findOne(ctx.params.id);
  }

  static async update(ctx: Context) {
    if (!ctx.user || !ctx.user.id) {
      ctx.set.status = 401;
      return { message: 'Unauthorized: User not authenticated.' };
    }
    const jobListing = await JobListingService.findOne(ctx.params.id);
    if (!jobListing) {
      ctx.set.status = 404;
      return { message: 'Job listing not found' };
    }
    // Only the poster or an admin can update
    if (ctx.user.id !== jobListing.postedById && ctx.user.role !== UserRole.ADMIN) {
      ctx.set.status = 403;
      return { message: 'Forbidden: You can only update your own job listings.' };
    }
    return JobListingService.update(ctx.params.id, ctx.body);
  }
}

export const jobModule = new Elysia()
  .use(authPlugin)
  .group('/jobs', (app) =>
    app
      .post('/', JobListingController.create, {
        body: createJobListingSchema,
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN])],
      })
      .get('/', JobListingController.findAll, { query: getJobListingsQuerySchema })
      .get('/:id', JobListingController.findOne)
      .put('/:id', JobListingController.update, {
        body: updateJobListingSchema,
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN])],
      })
      .delete('/:id', JobListingController.delete, {
        beforeHandle: [rbac([UserRole.USER, UserRole.ADMIN])],
      })
  );
