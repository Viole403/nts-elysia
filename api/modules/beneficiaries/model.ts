import { t } from 'elysia';

export const createBeneficiarySchema = t.Object({
  name: t.String(),
  account: t.String(),
  bank: t.String(),
  aliasName: t.String(),
  email: t.String(),
});

export const updateBeneficiarySchema = t.Partial(createBeneficiarySchema);