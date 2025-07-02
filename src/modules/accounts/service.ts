import { prisma } from '../../lib/prisma';
import { PaymentGateway } from '@prisma/client';
import { stripeService } from '../../services/stripe.service';
import { amazonService } from '../../services/amazon.service';
import { appleService } from '../../services/apple.service';
import { googleService } from '../../services/google.service';

export class PaymentAccountService {
  static async linkAccount(userId: string, data: { accountType: string; accountDetails: any; paymentGateway: PaymentGateway }) {
    const { accountType, accountDetails, paymentGateway } = data;

    let paymentAccountData: any = {
      userId,
      accountType,
      accountDetails,
      paymentGateway,
    };

    switch (paymentGateway) {
      case PaymentGateway.STRIPE:
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeAccountId: true, email: true } });
        if (!user?.stripeAccountId) {
          const newAccount = await stripeService.createAccount({ type: 'express' });
          await prisma.user.update({
            where: { id: userId },
            data: { stripeAccountId: newAccount.id },
          });
          paymentAccountData.stripeAccountId = newAccount.id;
        } else {
          paymentAccountData.stripeAccountId = user.stripeAccountId;
        }
        break;
      case PaymentGateway.AMAZON:
        paymentAccountData.amazonId = `amazon_account_${Date.now()}`;
        break;
      case PaymentGateway.APPLE:
        paymentAccountData.appleId = `apple_account_${Date.now()}`;
        break;
      case PaymentGateway.GOOGLE:
        paymentAccountData.googleId = `google_account_${Date.now()}`;
        break;
      default:
        break;
    }

    return prisma.paymentAccount.create({
      data: paymentAccountData,
    });
  }

  static async getAccountsByUserId(userId: string) {
    return prisma.paymentAccount.findMany({
      where: { userId },
    });
  }

  static async unlinkAccount(id: string, userId: string) {
    const account = await prisma.paymentAccount.findFirst({
      where: { id, userId },
    });

    if (!account) {
      throw new Error('Payment account not found or you do not have permission to unlink it.');
    }

    return prisma.paymentAccount.delete({
      where: { id },
    });
  }
}
