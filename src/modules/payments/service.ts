import { prisma } from '../../lib/prisma';
import { PaymentStatus, PaymentType, PaymentEntityType, PaymentGateway, LocalPaymentProvider, CryptoPaymentProvider, NotificationType, NotificationEntityType } from '@prisma/client';
import { localPaymentService } from '../../services/local_payment.service';
import { stripeService } from '../../services/stripe.service';
import { payPalService } from '../../services/paypal.service';
import { cryptoPaymentService } from '../../services/crypto_payment.service';
import { amazonService } from '../../services/amazon.service';
import { appleService } from '../../services/apple.service';
import { googleService } from '../../services/google.service';
import { NotificationManager } from '../../utils/notification.manager';
import { redis } from '../../plugins/redis.plugin';
import Stripe from 'stripe';

export class PaymentService {
  static async create(data: {
    userId: string;
    amount?: number; // Make amount optional as it can be derived for shop/course
    paymentType: PaymentType;
    entityId: string;
    entityType: PaymentEntityType;
    paymentGateway: PaymentGateway;
    quantity?: number; // Added quantity
  }) {
    const { userId, paymentType, entityId, entityType, paymentGateway, quantity } = data;
    let { amount } = data;

    // Derive amount for SHOP_ITEM_PURCHASE and COURSE_PURCHASE
    if (paymentType === PaymentType.SHOP_ITEM_PURCHASE) {
      const shopItem = await prisma.shopItem.findUnique({ where: { id: entityId } });
      if (!shopItem) throw new Error('Shop item not found');
      amount = shopItem.price * (quantity || 1);
    } else if (paymentType === PaymentType.COURSE_PURCHASE) {
      const course = await prisma.course.findUnique({ where: { id: entityId } });
      if (!course) throw new Error('Course not found');
      amount = course.price;
    }

    if (amount === undefined) {
      throw new Error('Payment amount is undefined');
    }

    let transactionDetails: any;
    let paymentRecord: any;

    const orderId = `order-${Date.now()}-${userId}`;

    switch (paymentGateway) {
      case PaymentGateway.LOCAL_PAYMENT:
        const localPaymentParams = {
          transaction_details: {
            order_id: orderId,
            gross_amount: amount,
          },
          customer_details: {
            first_name: 'John',
            last_name: 'Doe',
            email: 'john.doe@example.com',
          },
        };
        transactionDetails = await localPaymentService.createPayment(localPaymentParams);
        paymentRecord = await prisma.payment.create({
          data: {
            userId,
            amount,
            currency: 'IDR',
            status: PaymentStatus.PENDING,
            paymentType,
            entityId,
            entityType,
            quantity: quantity || 1, // Ensure quantity is saved
            midtransId: transactionDetails.token,
            paymentGateway,
            localPaymentProvider: localPaymentService.provider,
          },
        });

        // Store pending payment in Redis with TTL
        await redis.set(`pending_payment:${paymentRecord.id}`, 'true', 'EX', 900); // 15 minutes TTL

        return { ...paymentRecord, redirect_url: transactionDetails.redirect_url, payment_instructions: transactionDetails.payment_instructions };

      case PaymentGateway.STRIPE:
        const stripeSession = await stripeService.createCheckoutSession({
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `${entityType} Purchase`,
                },
                unit_amount: amount * 100, // Stripe uses cents
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${process.env.APP_BASE_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.APP_BASE_URL}/payment/cancel`,
          client_reference_id: userId,
          metadata: { entityId, entityType, paymentType, orderId },
        });

        paymentRecord = await prisma.payment.create({
          data: {
            userId,
            amount,
            currency: 'USD',
            status: PaymentStatus.PENDING,
            paymentType,
            entityId,
            entityType,
            quantity: quantity || 1, // Ensure quantity is saved
            stripeId: stripeSession.id,
            paymentGateway,
          },
        });
        // Store pending payment in Redis with TTL
        await redis.set(`pending_payment:${paymentRecord.id}`, 'true', 'EX', 900); // 15 minutes TTL

        return { ...paymentRecord, redirect_url: stripeSession.url, payment_instructions: 'Redirect to Stripe checkout.' };

      case PaymentGateway.PAYPAL:
        const paypalOrder = await payPalService.createOrder({
          intent: 'CAPTURE',
          purchase_units: [
            {
              reference_id: orderId,
              amount: {
                currency_code: 'USD',
                value: amount.toFixed(2),
              },
            },
          ],
          application_context: {
            return_url: `${process.env.APP_BASE_URL}/payment/paypal/success`,
            cancel_url: `${process.env.APP_BASE_URL}/payment/paypal/cancel`,
          },
        });

        paymentRecord = await prisma.payment.create({
          data: {
            userId,
            amount,
            currency: 'USD',
            status: PaymentStatus.PENDING,
            paymentType,
            entityId,
            entityType,
            quantity: quantity || 1, // Ensure quantity is saved
            paypalId: paypalOrder.id,
            paymentGateway,
          },
        });
        // Store pending payment in Redis with TTL
        await redis.set(`pending_payment:${paymentRecord.id}`, 'true', 'EX', 900); // 15 minutes TTL

        return { ...paymentRecord, orderId: paypalOrder.id, approval_url: paypalOrder.links.find((link: any) => link.rel === 'approve')?.href, payment_instructions: 'Redirect to PayPal for approval.' };

      case PaymentGateway.CRYPTO:
        const cryptoPayment = await cryptoPaymentService.createPayment(amount, 'BTC', userId, orderId);
        paymentRecord = await prisma.payment.create({
          data: {
            userId,
            amount,
            currency: 'BTC',
            status: PaymentStatus.PENDING,
            paymentType,
            entityId,
            entityType,
            quantity: quantity || 1, // Ensure quantity is saved
            cryptoId: cryptoPayment.transactionId,
            paymentGateway,
            cryptoPaymentProvider: cryptoPaymentService.provider,
          },
        });
        // Store pending payment in Redis with TTL
        await redis.set(`pending_payment:${paymentRecord.id}`, 'true', 'EX', 900); // 15 minutes TTL

        return { ...paymentRecord, ...cryptoPayment, payment_instructions: cryptoPayment.payment_instructions };

      case PaymentGateway.AMAZON:
        const amazonPayment = await amazonService.createPayment({ amount, userId, orderId });
        paymentRecord = await prisma.payment.create({
          data: {
            userId,
            amount,
            currency: 'USD',
            status: PaymentStatus.PENDING,
            paymentType,
            entityId,
            entityType,
            quantity: quantity || 1, // Ensure quantity is saved
            amazonId: amazonPayment.id,
            paymentGateway,
          },
        });
        // Store pending payment in Redis with TTL
        await redis.set(`pending_payment:${paymentRecord.id}`, 'true', 'EX', 900); // 15 minutes TTL

        return { ...paymentRecord, redirect_url: amazonPayment.redirect_url, payment_instructions: amazonPayment.payment_instructions };

      case PaymentGateway.APPLE:
        const applePayment = await appleService.createPayment({ amount, userId, orderId });
        paymentRecord = await prisma.payment.create({
          data: {
            userId,
            amount,
            currency: 'USD',
            status: PaymentStatus.PENDING,
            paymentType,
            entityId,
            entityType,
            quantity: quantity || 1, // Ensure quantity is saved
            appleId: applePayment.id,
            paymentGateway,
          },
        });
        // Store pending payment in Redis with TTL
        await redis.set(`pending_payment:${paymentRecord.id}`, 'true', 'EX', 900); // 15 minutes TTL

        return { ...paymentRecord, redirect_url: applePayment.redirect_url, payment_instructions: applePayment.payment_instructions };

      case PaymentGateway.GOOGLE:
        const googlePayment = await googleService.createPayment({ amount, userId, orderId });
        paymentRecord = await prisma.payment.create({
          data: {
            userId,
            amount,
            currency: 'USD',
            status: PaymentStatus.PENDING,
            paymentType,
            entityId,
            entityType,
            quantity: quantity || 1, // Ensure quantity is saved
            googleId: googlePayment.id,
            paymentGateway,
          },
        });
        // Store pending payment in Redis with TTL
        await redis.set(`pending_payment:${paymentRecord.id}`, 'true', 'EX', 900); // 15 minutes TTL

        return { ...paymentRecord, redirect_url: googlePayment.redirect_url, payment_instructions: googlePayment.payment_instructions };

      default:
        throw new Error('Unsupported payment gateway');
    }
  }

  static async handleLocalPaymentNotification(notificationData: any) {
    const notification = await localPaymentService.handleNotification(notificationData);
    const orderId = notification.order_id; // Assuming order_id is consistent across local providers
    const transactionStatus = notification.transaction_status; // Assuming consistent status naming
    const fraudStatus = notification.fraud_status; // Assuming consistent fraud status

    let newStatus: PaymentStatus;
    if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
      newStatus = PaymentStatus.SUCCESS;
    } else if (transactionStatus === 'pending') {
      newStatus = PaymentStatus.PENDING;
    } else {
      newStatus = PaymentStatus.FAILED;
    }

    const payment = await prisma.payment.updateMany({
      where: { midtransId: notification.transaction_id }, // Assuming transaction_id is consistent
      data: { status: newStatus },
    });

    if (newStatus === PaymentStatus.SUCCESS) {
      const updatedPayment = await prisma.payment.findFirst({ where: { midtransId: notification.transaction_id } });
      if (updatedPayment) {
        // Update stock for shop item purchases
        if (updatedPayment.entityType === PaymentEntityType.SHOP_ITEM) {
          await prisma.shopItem.update({
            where: { id: updatedPayment.entityId },
            data: {
              stock: { decrement: updatedPayment.quantity || 1 },
              reservedStock: { decrement: updatedPayment.quantity || 1 },
            },
          });
        }
        await NotificationManager.createNotification(
          updatedPayment.userId,
          NotificationType.PAYMENT_SUCCESS,
          updatedPayment.id,
          NotificationEntityType.PAYMENT,
          `Your payment for ${updatedPayment.entityType} was successful!`
        );
        await redisPublisher.publish(
          `user:${updatedPayment.userId}:payments`,
          JSON.stringify({ type: 'PAYMENT_SUCCESS', payment: updatedPayment })
        );
      }
    } else if (newStatus === PaymentStatus.FAILED || newStatus === PaymentStatus.EXPIRED) {
      const updatedPayment = await prisma.payment.findFirst({ where: { midtransId: notification.transaction_id } });
      if (updatedPayment && updatedPayment.entityType === PaymentEntityType.SHOP_ITEM) {
        // Release reserved stock for failed/expired shop item purchases
        await prisma.shopItem.update({
          where: { id: updatedPayment.entityId },
          data: { reservedStock: { decrement: updatedPayment.quantity || 1 } },
        });
      }
    }

    return payment;
  }

  static async handleStripeWebhook(payload: string | Buffer, signature: string | string[]) {
    const event = await stripeService.constructWebhookEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET || '');

    let payment: any;
    let updatedPaymentRecord: any;

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        updatedPaymentRecord = await prisma.payment.updateMany({
          where: { stripeId: session.id },
          data: { status: PaymentStatus.SUCCESS },
        });
        payment = await prisma.payment.findFirst({ where: { stripeId: session.id } });
        if (payment) {
          // Update stock for shop item purchases
          if (payment.entityType === PaymentEntityType.SHOP_ITEM) {
            await prisma.shopItem.update({
              where: { id: payment.entityId },
              data: {
                stock: { decrement: payment.quantity || 1 },
                reservedStock: { decrement: payment.quantity || 1 },
              },
            });
          }
          await NotificationManager.createNotification(
            payment.userId,
            NotificationType.PAYMENT_SUCCESS,
            payment.id,
            NotificationEntityType.PAYMENT,
            `Your payment for ${payment.entityType} was successful!`
          );
          await redis.publish(
            `user:${payment.userId}:payments`,
            JSON.stringify({ type: 'PAYMENT_SUCCESS', payment })
          );
          // Remove from Redis
          await redis.del(`pending_payment:${payment.id}`);
        }
        break;
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        updatedPaymentRecord = await prisma.payment.updateMany({
          where: { stripeId: paymentIntent.id },
          data: { status: PaymentStatus.SUCCESS },
        });
        payment = await prisma.payment.findFirst({ where: { stripeId: paymentIntent.id } });
        if (payment) {
          // Update stock for shop item purchases
          if (payment.entityType === PaymentEntityType.SHOP_ITEM) {
            await prisma.shopItem.update({
              where: { id: payment.entityId },
              data: {
                stock: { decrement: payment.quantity || 1 },
                reservedStock: { decrement: payment.quantity || 1 },
              },
            });
          }
          await NotificationManager.createNotification(
            payment.userId,
            NotificationType.PAYMENT_SUCCESS,
            payment.id,
            NotificationEntityType.PAYMENT,
            `Your payment for ${payment.entityType} was successful!`
          );
          await redis.publish(
            `user:${payment.userId}:payments`,
            JSON.stringify({ type: 'PAYMENT_SUCCESS', payment })
          );
          // Remove from Redis
          await redis.del(`pending_payment:${payment.id}`);
        }
        break;
      default:
        console.log(`Unhandled Stripe event type ${event.type}`);
    }
    return updatedPaymentRecord;
  }

  static async handlePayPalWebhook(payload: any, headers: any) {
    const isValid = await payPalService.validateWebhook(payload, headers);
    if (!isValid) {
      throw new Error('Invalid PayPal webhook signature');
    }

    let payment: any;
    let updatedPaymentRecord: any;

    switch (payload.event_type) {
      case 'CHECKOUT.ORDER.COMPLETED':
        const orderId = payload.resource.id;
        updatedPaymentRecord = await prisma.payment.updateMany({
          where: { paypalId: orderId },
          data: { status: PaymentStatus.SUCCESS },
        });
        payment = await prisma.payment.findFirst({ where: { paypalId: orderId } });
        if (payment) {
          // Update stock for shop item purchases
          if (payment.entityType === PaymentEntityType.SHOP_ITEM) {
            await prisma.shopItem.update({
              where: { id: payment.entityId },
              data: {
                stock: { decrement: payment.quantity || 1 },
                reservedStock: { decrement: payment.quantity || 1 },
              },
            });
          }
          await NotificationManager.createNotification(
            payment.userId,
            NotificationType.PAYMENT_SUCCESS,
            payment.id,
            NotificationEntityType.PAYMENT,
            `Your payment for ${payment.entityType} was successful!`
          );
          await redis.publish(
            `user:${payment.userId}:payments`,
            JSON.stringify({ type: 'PAYMENT_SUCCESS', payment })
          );
          // Remove from Redis
          await redis.del(`pending_payment:${payment.id}`);
        }
        break;
      default:
        console.log(`Unhandled PayPal event type ${payload.event_type}`);
    }
    return updatedPaymentRecord;
  }

  static async handleCryptoWebhook(payload: any, signature: string) {
    const isValid = await cryptoPaymentService.validateWebhook(payload, signature);
    if (!isValid) {
      throw new Error('Invalid Crypto webhook signature');
    }

    let payment: any;
    let updatedPaymentRecord: any;

    const { transactionId, status } = payload;

    if (status === 'CONFIRMED') {
      updatedPaymentRecord = await prisma.payment.updateMany({
        where: { cryptoId: transactionId },
        data: { status: PaymentStatus.SUCCESS },
      });
      payment = await prisma.payment.findFirst({ where: { cryptoId: transactionId } });
      if (payment) {
        // Update stock for shop item purchases
        if (payment.entityType === PaymentEntityType.SHOP_ITEM) {
          await prisma.shopItem.update({
            where: { id: payment.entityId },
            data: {
              stock: { decrement: payment.quantity || 1 },
              reservedStock: { decrement: payment.quantity || 1 },
            },
          });
        }
        await NotificationManager.createNotification(
          payment.userId,
          NotificationType.PAYMENT_SUCCESS,
          payment.id,
          NotificationEntityType.PAYMENT,
          `Your crypto payment for ${payment.entityType} was successful!`
        );
        await redisPublisher.publish(
          `user:${payment.userId}:payments`,
          JSON.stringify({ type: 'PAYMENT_SUCCESS', payment })
        );
        // Remove from Redis
        await redisPublisher.del(`pending_payment:${payment.id}`);
      }
    } else if (status === 'FAILED') {
      updatedPaymentRecord = await prisma.payment.updateMany({
        where: { cryptoId: transactionId },
        data: { status: PaymentStatus.FAILED },
      });
      payment = await prisma.payment.findFirst({ where: { cryptoId: transactionId } });
      if (payment) {
        // Release reserved stock for failed/expired shop item purchases
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
          `Your crypto payment for ${payment.entityType} failed.`
        );
        await redisPublisher.publish(
          `user:${payment.userId}:payments`,
          JSON.stringify({ type: 'PAYMENT_FAILURE', payment })
        );
        // Remove from Redis
        await redisPublisher.del(`pending_payment:${payment.id}`);
      }
    }
    return updatedPaymentRecord;
  }

  static async handleAmazonWebhook(payload: any) {
    console.log('Handling Amazon webhook:', payload);
    // Implement Amazon webhook verification and payment status update
    return { message: 'Amazon webhook processed' };
  }

  static async handleAppleWebhook(payload: any) {
    console.log('Handling Apple webhook:', payload);
    // Implement Apple webhook verification and payment status update
    return { message: 'Apple webhook processed' };
  }

  static async handleGoogleWebhook(payload: any) {
    console.log('Handling Google webhook:', payload);
    // Implement Google webhook verification and payment status update
    return { message: 'Google webhook processed' };
  }

  static async getPaymentStatus(orderId: string, paymentGateway: PaymentGateway) {
    let statusResult: any;
    let newStatus: PaymentStatus;

    switch (paymentGateway) {
      case PaymentGateway.LOCAL_PAYMENT:
        statusResult = await localPaymentService.getTransactionStatus(orderId);
        if (statusResult.status === 'COMPLETED') {
          newStatus = PaymentStatus.SUCCESS;
        } else if (statusResult.status === 'PENDING') {
          newStatus = PaymentStatus.PENDING;
        } else {
          newStatus = PaymentStatus.FAILED;
        }
        break;
      case PaymentGateway.STRIPE:
        statusResult = await stripeService.retrievePaymentIntent(orderId);
        if (statusResult.status === 'succeeded') {
          newStatus = PaymentStatus.SUCCESS;
        } else if (statusResult.status === 'pending') {
          newStatus = PaymentStatus.PENDING;
        } else {
          newStatus = PaymentStatus.FAILED;
        }
        break;
      case PaymentGateway.PAYPAL:
        statusResult = await payPalService.getOrder(orderId);
        if (statusResult.status === 'COMPLETED') {
          newStatus = PaymentStatus.SUCCESS;
        } else if (statusResult.status === 'CREATED' || statusResult.status === 'APPROVED') {
          newStatus = PaymentStatus.PENDING;
        } else {
          newStatus = PaymentStatus.FAILED;
        }
        break;
      case PaymentGateway.CRYPTO:
        statusResult = await cryptoPaymentService.getPaymentStatus(orderId);
        if (statusResult.status === 'CONFIRMED') {
          newStatus = PaymentStatus.SUCCESS;
        } else if (statusResult.status === 'PENDING') {
          newStatus = PaymentStatus.PENDING;
        } else {
          newStatus = PaymentStatus.FAILED;
        }
        break;
      case PaymentGateway.AMAZON:
        statusResult = await amazonService.getTransactionStatus(orderId);
        if (statusResult.status === 'COMPLETED') {
          newStatus = PaymentStatus.SUCCESS;
        } else if (statusResult.status === 'PENDING') {
          newStatus = PaymentStatus.PENDING;
        } else {
          newStatus = PaymentStatus.FAILED;
        }
        break;
      case PaymentGateway.APPLE:
        statusResult = await appleService.getTransactionStatus(orderId);
        if (statusResult.status === 'COMPLETED') {
          newStatus = PaymentStatus.SUCCESS;
        } else if (statusResult.status === 'PENDING') {
          newStatus = PaymentStatus.PENDING;
        } else {
          newStatus = PaymentStatus.FAILED;
        }
        break;
      case PaymentGateway.GOOGLE:
        statusResult = await googleService.getTransactionStatus(orderId);
        if (statusResult.status === 'COMPLETED') {
          newStatus = PaymentStatus.SUCCESS;
        } else if (statusResult.status === 'PENDING') {
          newStatus = PaymentStatus.PENDING;
        } else {
          newStatus = PaymentStatus.FAILED;
        }
        break;
      default:
        throw new Error('Unsupported payment gateway');
    }

    await prisma.payment.updateMany({
      where: {
        OR: [
          { midtransId: orderId },
          { stripeId: orderId },
          { paypalId: orderId },
          { cryptoId: orderId },
          { amazonId: orderId },
          { appleId: orderId },
          { googleId: orderId },
        ],
      },
      data: { status: newStatus },
    });

    if (newStatus !== PaymentStatus.PENDING) {
      const payment = await prisma.payment.findFirst({
        where: {
          OR: [
            { midtransId: orderId },
            { stripeId: orderId },
            { paypalId: orderId },
            { cryptoId: orderId },
            { amazonId: orderId },
            { appleId: orderId },
            { googleId: orderId },
          ],
        },
      });
      if (payment) {
        // Release reserved stock if payment status is not pending and it's a shop item
        if (payment.entityType === PaymentEntityType.SHOP_ITEM && (newStatus === PaymentStatus.FAILED || newStatus === PaymentStatus.EXPIRED)) {
          await prisma.shopItem.update({
            where: { id: payment.entityId },
            data: { reservedStock: { decrement: payment.quantity || 1 } },
          });
        }
        await redisPublisher.del(`pending_payment:${payment.id}`);
      }
    }

    return { status: newStatus, gatewayResponse: statusResult };
  }
}