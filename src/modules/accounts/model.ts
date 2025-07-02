import { t } from 'elysia';

export const linkPaymentAccountSchema = t.Object({
  accountType: t.String(), // e.g., 'bank_account', 'gopay'
  accountDetails: t.Any(), // JSON object with details specific to accountType
  paymentGateway: t.String(), // e.g., 'STRIPE', 'MIDTRANS'
});
