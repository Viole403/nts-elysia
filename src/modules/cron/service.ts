import { prisma } from '../../lib/prisma';
import { redis } from '../../plugins/redis.plugin';
import { NotificationManager } from '../../utils/notification.manager';
import { NotificationType, NotificationEntityType, PaymentStatus, PaymentEntityType } from '@prisma/client';

export class CronService {
  static async healthCheck() {
    const startTime = Date.now();
    // In a real application, you would check the status of your database, redis, etc.
    const status = 'OK';
    const endTime = Date.now();
    const responseTimeMs = endTime - startTime;

    await prisma.healthCheckLog.create({
      data: {
        status,
        responseTimeMs,
      },
    });

    console.log('Health check completed');
  }

  static async dataMigration() {
    const migrationName = `migration-${Date.now()}`;
    try {
      // In a real application, you would run your data migration scripts here
      await prisma.dataMigrationLog.create({
        data: {
          migrationName,
          status: 'SUCCESS',
        },
      });
      console.log('Data migration completed');
    } catch (error: any) {
      await prisma.dataMigrationLog.create({
        data: {
          migrationName,
          status: 'FAILED',
          logs: error.message,
        },
      });
      console.error('Data migration failed', error);
    }
  }

  static async checkExpiredPayments() {
    console.log('Checking for expired payments...');
    const expiredPaymentKeys = await redis.keys('pending_payment:*');

    for (const key of expiredPaymentKeys) {
      const paymentId = key.replace('pending_payment:', '');
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
      });

      if (payment && payment.status === PaymentStatus.PENDING) {
        // Check if the key has actually expired in Redis
        const ttl = await redis.ttl(key);
        if (ttl === -2) { // -2 means the key does not exist
          await prisma.payment.update({
            where: { id: paymentId },
            data: { status: PaymentStatus.EXPIRED },
          });
          // Release reserved stock for expired shop item purchases
          if (payment.entityType === PaymentEntityType.SHOP_ITEM) {
            await prisma.shopItem.update({
              where: { id: payment.entityId },
              data: { reservedStock: { decrement: payment.quantity || 1 } },
            });
          }
          await NotificationManager.createNotification(
            payment.userId,
            NotificationType.PAYMENT_FAILURE,
            payment.id,
            NotificationEntityType.PAYMENT,
            `Your payment for ${payment.entityType} has expired.`
          );
          console.log(`Payment ${paymentId} marked as EXPIRED.`);
        }
      }
    }
  }
}
