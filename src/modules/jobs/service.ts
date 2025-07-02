import { prisma } from '../../lib/prisma';
import { EmploymentType, SalaryPeriod, JobStatus } from '@prisma/client';

export class JobListingService {
  static async create(data: { title: string; description: string; companyName: string; location: string; employmentType: EmploymentType; salaryMin?: number; salaryMax?: number; salaryPeriod?: SalaryPeriod; postedById: string }) {
    return prisma.jobListing.create({
      data,
    });
  }

  static async findAll(filters: { employmentType?: EmploymentType; location?: string; status?: JobStatus; salaryMin?: number; salaryMax?: number }, page: number = 1, limit: number = 10) {
    const where: any = {};
    if (filters.employmentType) {
      where.employmentType = filters.employmentType;
    }
    if (filters.location) {
      where.location = { contains: filters.location, mode: 'insensitive' };
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.salaryMin) {
      where.salaryMin = { gte: filters.salaryMin };
    }
    if (filters.salaryMax) {
      where.salaryMax = { lte: filters.salaryMax };
    }

    const skip = (page - 1) * limit;

    const jobListings = await prisma.jobListing.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    const total = await prisma.jobListing.count({ where });
    return { jobListings, total, page, limit };
  }

  static async findOne(id: string) {
    return prisma.jobListing.findUnique({
      where: { id },
    });
  }

  static async update(id: string, data: any) {
    return prisma.jobListing.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string) {
    return prisma.jobListing.delete({
      where: { id },
    });
  }
}
