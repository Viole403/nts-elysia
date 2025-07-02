import { t } from 'elysia';
import { PaymentGateway, SubscriptionStatus } from '@prisma/client';

export const createSubscriptionSchema = t.Object({
  plan: t.String(),
  paymentGateway: t.Enum(PaymentGateway),
  // Add more fields as needed for specific subscription types (e.g., trial_period_days, metadata)
});

export const updateSubscriptionStatusSchema = t.Object({
  status: t.Enum(SubscriptionStatus),
});
