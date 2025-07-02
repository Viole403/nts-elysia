import { describe, expect, it, beforeEach } from 'bun:test';
import app from '../src/index';
import { prisma } from '../src/lib/prisma';
import { EmploymentType, JobStatus, UserRole } from '@prisma/client';

// Mock Prisma
const mockPrisma = {
  jobListing: {
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

describe('Job Listings Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /jobs', () => {
    it('should create a new job listing successfully', async () => {
      const newJobListing = {
        title: 'Software Engineer',
        description: 'Develop and maintain software.',
        companyName: 'Tech Corp',
        location: 'Remote',
        employmentType: EmploymentType.FULL_TIME,
        postedById: 'userId123',
      };

      mockPrisma.jobListing.create.mockResolvedValue({
        id: 'job1',
        ...newJobListing,
        status: JobStatus.OPEN,
      });

      const response = await app.handle(
        new Request('http://localhost/jobs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockUserToken}`,
          },
          body: JSON.stringify(newJobListing),
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.title).toBe(newJobListing.title);
      expect(mockPrisma.jobListing.create).toHaveBeenCalledWith({
        data: newJobListing,
      });
    });

    it('should return 401 if not authenticated', async () => {
      const newJobListing = {
        title: 'Software Engineer',
        description: 'Develop and maintain software.',
        companyName: 'Tech Corp',
        location: 'Remote',
        employmentType: EmploymentType.FULL_TIME,
        postedById: 'userId123',
      };

      const response = await app.handle(
        new Request('http://localhost/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newJobListing),
        })
      );

      expect(response.status).toBe(401);
    });

    it('should return 403 if user does not have USER or ADMIN role', async () => {
      const newJobListing = {
        title: 'Software Engineer',
        description: 'Develop and maintain software.',
        companyName: 'Tech Corp',
        location: 'Remote',
        employmentType: EmploymentType.FULL_TIME,
        postedById: 'userId123',
      };

      const mockInstructorToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Imluc3RydWN0b3JJZDEyMyIsImVtYWlsIjoiaW5zdHJ1Y3RvckBleGFtcGxlLmNvbSIsInJvbGUiOiJJTlNUUlVDVE9SIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMTcyMDB9.dummy_instructor_token';

      const response = await app.handle(
        new Request('http://localhost/jobs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockInstructorToken}`,
          },
          body: JSON.stringify(newJobListing),
        })
      );

      expect(response.status).toBe(403);
    });
  });

  describe('GET /jobs', () => {
    it('should return a list of job listings', async () => {
      const mockJobListings = [
        { id: 'j1', title: 'Job 1', companyName: 'Comp1', employmentType: EmploymentType.FULL_TIME },
        { id: 'j2', title: 'Job 2', companyName: 'Comp2', employmentType: EmploymentType.PART_TIME },
      ];
      mockPrisma.jobListing.findMany.mockResolvedValue(mockJobListings);
      mockPrisma.jobListing.count.mockResolvedValue(2);

      const response = await app.handle(
        new Request('http://localhost/jobs', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.jobListings).toEqual(mockJobListings);
      expect(body.total).toBe(2);
    });
  });

  describe('GET /jobs/:id', () => {
    it('should return a single job listing', async () => {
      const mockJobListing = { id: 'j1', title: 'Job 1', companyName: 'Comp1', employmentType: EmploymentType.FULL_TIME };
      mockPrisma.jobListing.findUnique.mockResolvedValue(mockJobListing);

      const response = await app.handle(
        new Request('http://localhost/jobs/j1', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.title).toBe('Job 1');
      expect(mockPrisma.jobListing.findUnique).toHaveBeenCalledWith({ where: { id: 'j1' } });
    });

    it('should return 404 if job listing not found', async () => {
      mockPrisma.jobListing.findUnique.mockResolvedValue(null);

      const response = await app.handle(
        new Request('http://localhost/jobs/non-existent-job', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /jobs/:id', () => {
    it('should update a job listing successfully by poster', async () => {
      const jobListingId = 'job1';
      const existingJobListing = { id: jobListingId, title: 'Old Title', postedById: 'userId123' };
      const updatedData = { title: 'New Title', location: 'On-site' };

      mockPrisma.jobListing.findUnique.mockResolvedValue(existingJobListing);
      mockPrisma.jobListing.update.mockResolvedValue({ ...existingJobListing, ...updatedData });

      const response = await app.handle(
        new Request(`http://localhost/jobs/${jobListingId}`,
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
      expect(body.location).toBe('On-site');
      expect(mockPrisma.jobListing.update).toHaveBeenCalledWith({
        where: { id: jobListingId },
        data: updatedData,
      });
    });

    it('should return 403 if user is not poster or admin', async () => {
      const jobListingId = 'job1';
      const existingJobListing = { id: jobListingId, title: 'Old Title', postedById: 'otherUser', employmentType: EmploymentType.FULL_TIME };
      const updatedData = { title: 'New Title' };

      mockPrisma.jobListing.findUnique.mockResolvedValue(existingJobListing);

      const response = await app.handle(
        new Request(`http://localhost/jobs/${jobListingId}`,
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

  describe('DELETE /jobs/:id', () => {
    it('should delete a job listing successfully by poster', async () => {
      const jobListingId = 'job1';
      const existingJobListing = { id: jobListingId, title: 'Job to Delete', postedById: 'userId123' };

      mockPrisma.jobListing.findUnique.mockResolvedValue(existingJobListing);
      mockPrisma.jobListing.delete.mockResolvedValue(existingJobListing);

      const response = await app.handle(
        new Request(`http://localhost/jobs/${jobListingId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${mockUserToken}`,
            },
          })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe(jobListingId);
      expect(mockPrisma.jobListing.delete).toHaveBeenCalledWith({ where: { id: jobListingId } });
    });

    it('should return 403 if user is not poster or admin', async () => {
      const jobListingId = 'job1';
      const existingJobListing = { id: jobListingId, title: 'Job to Delete', postedById: 'otherUser', employmentType: EmploymentType.FULL_TIME };

      mockPrisma.jobListing.findUnique.mockResolvedValue(existingJobListing);

      const response = await app.handle(
        new Request(`http://localhost/jobs/${jobListingId}`,
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
});