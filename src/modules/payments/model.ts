import { t } from 'elysia';
import { PaymentEntityType, PaymentGateway } from '@prisma/client';

export const createPaymentSchema = t.Object({
  entityType: t.Enum(PaymentEntityType),
  entityId: t.String(),
  quantity: t.Optional(t.Numeric()), // Added quantity for shop items
  paymentGateway: t.Enum(PaymentGateway),
});
