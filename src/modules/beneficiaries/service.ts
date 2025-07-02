import { prisma } from '../../lib/prisma';
import { redisPublisher } from '../../plugins/redis.plugin';

export class BeneficiaryService {
  static async create(data: { userId: string; name: string; account: string; bank: string; aliasName: string; email: string }) {
    const beneficiary = await prisma.beneficiary.create({
      data,
    });
    // Invalidate cache for this user's beneficiaries
    await redisPublisher.del(`beneficiaries:user:${data.userId}`);
    return beneficiary;
  }

  static async findAll(userId: string) {
    const cacheKey = `beneficiaries:user:${userId}`;
    const cachedBeneficiaries = await redisPublisher.get(cacheKey);
    if (cachedBeneficiaries) {
      return JSON.parse(cachedBeneficiaries);
    }

    const beneficiaries = await prisma.beneficiary.findMany({
      where: { userId },
    });
    await redisPublisher.set(cacheKey, JSON.stringify(beneficiaries), 'EX', 3600); // Cache for 1 hour
    return beneficiaries;
  }

  static async update(id: string, userId: string, data: any) {
    const beneficiary = await prisma.beneficiary.findFirst({
      where: { id, userId },
    });

    if (!beneficiary) {
      throw new Error('Beneficiary not found or you do not have permission to update it.');
    }

    const updatedBeneficiary = await prisma.beneficiary.update({
      where: { id },
      data,
    });
    // Invalidate cache for this user's beneficiaries
    await redisPublisher.del(`beneficiaries:user:${userId}`);
    return updatedBeneficiary;
  }

  static async delete(id: string, userId: string) {
    const beneficiary = await prisma.beneficiary.findFirst({
      where: { id, userId },
    });

    if (!beneficiary) {
      throw new Error('Beneficiary not found or you do not have permission to delete it.');
    }

    const deletedBeneficiary = await prisma.beneficiary.delete({
      where: { id },
    });
    // Invalidate cache for this user's beneficiaries
    await redisPublisher.del(`beneficiaries:user:${userId}`);
    return deletedBeneficiary;
  }
}
