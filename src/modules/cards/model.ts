import { t } from 'elysia';
import { PaymentGateway } from '@prisma/client';

export const registerCardSchema = t.Object({
  paymentGateway: t.Enum(PaymentGateway),
  token: t.String(), // Token obtained from client-side SDK (e.g., Midtrans, Stripe)
  cardType: t.String(),
  maskedCard: t.String(),
  bank: t.Optional(t.String()),
});
