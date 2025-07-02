import { prisma } from '../../lib/prisma';
import { PaymentGateway, SubscriptionStatus, NotificationType, NotificationEntityType } from '@prisma/client';
import { stripeService } from '../../services/stripe.service';
import { payPalService } from '../../services/paypal.service';
import { localPaymentService } from '../../services/local_payment.service';
import { amazonService } from '../../services/amazon.service';
import { appleService } from '../../services/apple.service';
import { googleService } from '../../services/google.service';
import { NotificationManager } from '../../utils/notification.manager';
import { redisPublisher } from '../../plugins/redis.plugin';

export class SubscriptionService {
  static async create(userId: string, plan: string, paymentGateway: PaymentGateway) {
    let subscriptionData: any = {
      userId,
      plan,
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Example: 30 days
      paymentGateway,
    };

    switch (paymentGateway) {
      case PaymentGateway.STRIPE:
        const stripeSubscription = await stripeService.createSubscription({
          customer: 'cus_example', // Replace with actual customer ID
          items: [{ price: 'price_example' }], // Replace with actual price ID
        });
        subscriptionData.stripeId = stripeSubscription.id;
        break;
      case PaymentGateway.PAYPAL:
        const paypalSubscription = await payPalService.createOrder({
          intent: 'CAPTURE',
          purchase_units: [
            {
              amount: {
                currency_code: 'USD',
                value: '10.00',
              },
            },
          ],
        });
        subscriptionData.paypalId = paypalSubscription.id;
        break;
      case PaymentGateway.LOCAL_PAYMENT:
        subscriptionData.midtransId = `local_sub_${Date.now()}`;
        break;
      case PaymentGateway.AMAZON:
        subscriptionData.amazonId = `amazon_sub_${Date.now()}`;
        break;
      case PaymentGateway.APPLE:
        subscriptionData.appleId = `apple_sub_${Date.now()}`;
        break;
      case PaymentGateway.GOOGLE:
        subscriptionData.googleId = `google_sub_${Date.now()}`;
        break;
      default:
        throw new Error('Unsupported payment gateway for subscriptions');
    }

    const subscription = await prisma.subscription.create({
      data: subscriptionData,
    });

    await NotificationManager.createNotification(
      userId,
      NotificationType.PAYMENT_SUCCESS,
      subscription.id,
      NotificationEntityType.SUBSCRIPTION,
      `Your ${plan} subscription is now active!`
    );

    await redisPublisher.publish(
      `user:${userId}:subscriptions`,
      JSON.stringify({ type: 'SUBSCRIPTION_CREATED', subscription })
    );

    return subscription;
  }

  static async updateStatus(id: string, status: SubscriptionStatus, userId: string) {
    const subscription = await prisma.subscription.update({
      where: { id },
      data: { status },
    });

    switch (subscription.paymentGateway) {
      case PaymentGateway.STRIPE:
        if (status === SubscriptionStatus.CANCELLED) {
          await stripeService.cancelSubscription(subscription.stripeId!); // Assuming stripeId exists
        }
        break;
      // Add other gateway updates
    }

    await NotificationManager.createNotification(
      userId,
      NotificationType.PAYMENT_SUCCESS,
      subscription.id,
      NotificationEntityType.SUBSCRIPTION,
      `Your ${subscription.plan} subscription status changed to ${status}`
    );

    await redisPublisher.publish(
      `user:${userId}:subscriptions`,
      JSON.stringify({ type: 'SUBSCRIPTION_UPDATED', subscription })
    );

    return subscription;
  }

  static async findByUserId(userId: string) {
    return prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}