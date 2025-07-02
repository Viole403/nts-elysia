import { prisma } from '../../lib/prisma';
import { PaymentGateway } from '@prisma/client';
import { stripeService } from '../../services/stripe.service';
import { localPaymentService } from '../../services/local_payment.service';
import { amazonService } from '../../services/amazon.service';
import { appleService } from '../../services/apple.service';
import { googleService } from '../../services/google.service';

export class CardService {
  static async registerCard(userId: string, paymentGateway: PaymentGateway, token: string, cardType: string, maskedCard: string, bank?: string) {
    let cardRegistrationData: any = {
      userId,
      cardToken: token,
      cardType,
      maskedCard,
      paymentGateway,
      bank,
    };

    switch (paymentGateway) {
      case PaymentGateway.LOCAL_PAYMENT:
        cardRegistrationData.midtransId = `${localPaymentService.provider}_card_${Date.now()}`;
        break;
      case PaymentGateway.STRIPE:
        const customer = await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
        let stripeCustomerId = customer?.stripeCustomerId;

        if (!stripeCustomerId) {
          const newCustomer = await stripeService.createCustomer({ email: (await prisma.user.findUnique({ where: { id: userId } }))?.email });
          stripeCustomerId = newCustomer.id;
          await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId } });
        }

        await stripeService.attachPaymentMethod(token, stripeCustomerId);
        cardRegistrationData.stripeId = token;
        break;
      case PaymentGateway.PAYPAL:
        // PayPal Vault integration would go here
        break;
      case PaymentGateway.AMAZON:
        cardRegistrationData.amazonId = `amazon_card_${Date.now()}`;
        break;
      case PaymentGateway.APPLE:
        cardRegistrationData.appleId = `apple_card_${Date.now()}`;
        break;
      case PaymentGateway.GOOGLE:
        cardRegistrationData.googleId = `google_card_${Date.now()}`;
        break;
      default:
        throw new Error('Unsupported payment gateway for card registration');
    }

    return prisma.cardRegistration.create({
      data: cardRegistrationData,
    });
  }

  static async getCardsByUserId(userId: string) {
    return prisma.cardRegistration.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async deleteCard(id: string, userId: string) {
    const card = await prisma.cardRegistration.findUnique({ where: { id }, select: { paymentGateway: true, userId: true } });
    if (!card || card.userId !== userId) {
      throw new Error('Card not found or unauthorized');
    }

    switch (card.paymentGateway) {
      case PaymentGateway.STRIPE:
        // In a real application, you might detach the payment method from the customer
        // await stripeService.detachPaymentMethod(card.stripeId, card.userId);
        break;
      default:
        break;
    }

    return prisma.cardRegistration.delete({
      where: { id },
    });
  }
}
