import { t } from 'elysia';
import { PayoutGateway } from '@prisma/client';

export const createPayoutSchema = t.Object({
  beneficiaryId: t.String(),
  amount: t.Numeric(),
  notes: t.Optional(t.String()),
  payoutGateway: t.Enum(PayoutGateway),
});