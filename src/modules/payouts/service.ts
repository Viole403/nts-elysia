import { prisma } from '../../lib/prisma';
import { PayoutGateway, PayoutStatus, LocalPayoutProvider, CryptoPayoutProvider, PaymentGateway } from '@prisma/client';
import { localPaymentService } from '../../services/local_payment.service';
import { stripeService } from '../../services/stripe.service';
import { payPalService } from '../../services/paypal.service';
import { cryptoPaymentService } from '../../services/crypto_payment.service';
import { amazonService } from '../../services/amazon.service';
import { appleService } from '../../services/apple.service';
import { googleService } from '../../services/google.service';
import { redisPublisher } from '../../plugins/redis.plugin';

export class PayoutService {
  static async create(data: { userId: string; beneficiaryId: string; amount: number; notes?: string; payoutGateway: PayoutGateway }) {
    const { userId, beneficiaryId, amount, notes, payoutGateway } = data;

    const beneficiary = await prisma.beneficiary.findFirst({
      where: { id: beneficiaryId, userId },
    });

    if (!beneficiary) {
      throw new Error('Beneficiary not found or does not belong to the user.');
    }

    let payoutResult: any;
    const referenceNo = `payout-${Date.now()}`;

    switch (payoutGateway) {
      case PayoutGateway.LOCAL_PAYOUT:
        payoutResult = await localPaymentService.createPayout({
          beneficiary_name: beneficiary.name,
          beneficiary_account: beneficiary.account,
          beneficiary_bank: beneficiary.bank,
          beneficiary_email: beneficiary.email,
          amount: amount,
          notes: notes || 'Payout',
          reference_no: referenceNo,
        });
        break;
      case PayoutGateway.STRIPE_PAYOUTS:
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeAccountId: true } });
        if (!user?.stripeAccountId) {
          throw new Error('User does not have a Stripe account for payouts.');
        }
        payoutResult = await stripeService.createTransfer(
          {
            amount: amount * 100, // Stripe uses cents
            currency: 'usd',
            destination: user.stripeAccountId,
            transfer_group: referenceNo,
          }
        );
        break;
      case PayoutGateway.PAYPAL_PAYOUTS:
        payoutResult = await payPalService.createPayout({
          sender_batch_header: {
            sender_batch_id: referenceNo,
            email_subject: 'You have a new payout!',
          },
          items: [
            {
              recipient_type: 'EMAIL',
              amount: {
                value: amount.toFixed(2),
                currency: 'USD',
              },
              receiver: beneficiary.email,
              note: notes || 'Your payout',
              sender_item_id: referenceNo,
            },
          ],
        });
        break;
      case PayoutGateway.CRYPTO_PAYOUTS:
        payoutResult = await cryptoPaymentService.createPayout(amount, 'BTC', beneficiary.account, userId, referenceNo);
        break;
      case PayoutGateway.AMAZON:
        payoutResult = await amazonService.createPayout({ amount, beneficiaryAddress: beneficiary.account, referenceNo });
        break;
      case PayoutGateway.APPLE:
        payoutResult = await appleService.createPayout({ amount, beneficiaryAddress: beneficiary.account, referenceNo });
        break;
      case PayoutGateway.GOOGLE:
        payoutResult = await googleService.createPayout({ amount, beneficiaryAddress: beneficiary.account, referenceNo });
        break;
      default:
        throw new Error('Unsupported payout gateway');
    }

    const payout = await prisma.payout.create({
      data: {
        userId,
        beneficiaryId,
        amount,
        status: PayoutStatus.PENDING,
        payoutGateway,
        midtransId: payoutGateway === PayoutGateway.LOCAL_PAYOUT ? payoutResult.reference_no : undefined,
        stripeId: payoutGateway === PayoutGateway.STRIPE_PAYOUTS ? payoutResult.id : undefined,
        paypalId: payoutGateway === PayoutGateway.PAYPAL_PAYOUTS ? payoutResult.batch_header.payout_batch_id : undefined,
        cryptoId: payoutGateway === PayoutGateway.CRYPTO_PAYOUTS ? payoutResult.payoutTransactionId : undefined,
        amazonId: payoutGateway === PayoutGateway.AMAZON ? payoutResult.id : undefined,
        appleId: payoutGateway === PayoutGateway.APPLE ? payoutResult.id : undefined,
        googleId: payoutGateway === PayoutGateway.GOOGLE ? payoutResult.id : undefined,
        localPayoutProvider: payoutGateway === PayoutGateway.LOCAL_PAYOUT ? localPaymentService.provider : undefined,
        cryptoPayoutProvider: payoutGateway === PayoutGateway.CRYPTO_PAYOUTS ? cryptoPaymentService.provider : undefined,
      },
    });

    // Invalidate cache for this payout
    await redisPublisher.del(`payout:${payout.id}`);

    return payout;
  }

  static async getStatus(referenceNo: string, userId: string) {
    const cacheKey = `payout:${referenceNo}`;
    const cachedStatus = await redisPublisher.get(cacheKey);
    if (cachedStatus) {
      return JSON.parse(cachedStatus);
    }

    const payout = await prisma.payout.findFirst({
      where: {
        user: { id: userId },
        OR: [
          { midtransId: referenceNo },
          { stripeId: referenceNo },
          { paypalId: referenceNo },
          { cryptoId: referenceNo },
          { amazonId: referenceNo },
          { appleId: referenceNo },
          { googleId: referenceNo },
        ],
      },
    });

    if (!payout) {
      throw new Error('Payout not found or you do not have permission to view it.');
    }

    let statusResult: any;
    switch (payout.payoutGateway) {
      case PayoutGateway.LOCAL_PAYOUT:
        statusResult = await localPaymentService.getPayoutStatus(referenceNo);
        break;
      case PayoutGateway.STRIPE_PAYOUTS:
        statusResult = await stripeService.retrieveTransfer(referenceNo);
        break;
      case PayoutGateway.PAYPAL_PAYOUTS:
        statusResult = await payPalService.getPayoutStatus(referenceNo);
        break;
      case PayoutGateway.CRYPTO_PAYOUTS:
        statusResult = await cryptoPaymentService.getPayoutStatus(referenceNo);
        break;
      case PayoutGateway.AMAZON:
        statusResult = await amazonService.getPayoutStatus(referenceNo);
        break;
      case PayoutGateway.APPLE:
        statusResult = await appleService.getPayoutStatus(referenceNo);
        break;
      case PayoutGateway.GOOGLE:
        statusResult = await googleService.getPayoutStatus(referenceNo);
        break;
      default:
        throw new Error('Unsupported payout gateway');
    }

    await redisPublisher.set(cacheKey, JSON.stringify(statusResult), 'EX', 60); // Cache for 1 minute

    return statusResult;
  }
}