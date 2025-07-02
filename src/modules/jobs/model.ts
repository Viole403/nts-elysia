import { t } from 'elysia';
import { EmploymentType, SalaryPeriod, JobStatus } from '@prisma/client';

export const createJobListingSchema = t.Object({
  title: t.String(),
  description: t.String(),
  companyName: t.String(),
  location: t.String(),
  employmentType: t.Enum(EmploymentType),
  salaryMin: t.Optional(t.Numeric()),
  salaryMax: t.Optional(t.Numeric()),
  salaryPeriod: t.Optional(t.Enum(SalaryPeriod)),
});

export const updateJobListingSchema = t.Object({
  title: t.Optional(t.String()),
  description: t.Optional(t.String()),
  companyName: t.Optional(t.String()),
  location: t.Optional(t.String()),
  employmentType: t.Optional(t.Enum(EmploymentType)),
  salaryMin: t.Optional(t.Numeric()),
  salaryMax: t.Optional(t.Numeric()),
  salaryPeriod: t.Optional(t.Enum(SalaryPeriod)),
  status: t.Optional(t.Enum(JobStatus)),
});

export const getJobListingsQuerySchema = t.Object({
  employmentType: t.Optional(t.Enum(EmploymentType)),
  location: t.Optional(t.String()),
  status: t.Optional(t.Enum(JobStatus)),
  salaryMin: t.Optional(t.Numeric()),
  salaryMax: t.Optional(t.Numeric()),
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});
