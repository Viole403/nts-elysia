import Stripe from 'stripe';

export class StripeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2024-04-10', // Use your desired API version
    });
  }

  async createCheckoutSession(params: Stripe.Checkout.SessionCreateParams) {
    return this.stripe.checkout.sessions.create(params);
  }

  async createPaymentIntent(params: Stripe.PaymentIntentCreateParams) {
    return this.stripe.paymentIntents.create(params);
  }

  async retrievePaymentIntent(id: string) {
    return this.stripe.paymentIntents.retrieve(id);
  }

  async constructWebhookEvent(payload: string | Buffer, signature: string | string[], secret: string) {
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }

  async createSetupIntent(params: Stripe.SetupIntentCreateParams) {
    return this.stripe.setupIntents.create(params);
  }

  async retrieveSetupIntent(id: string) {
    return this.stripe.setupIntents.retrieve(id);
  }

  async createCustomer(params: Stripe.CustomerCreateParams) {
    return this.stripe.customers.create(params);
  }

  async createPaymentMethod(params: Stripe.PaymentMethodCreateParams) {
    return this.stripe.paymentMethods.create(params);
  }

  async attachPaymentMethod(paymentMethodId: string, customerId: string) {
    return this.stripe.paymentMethods.attach(
      paymentMethodId,
      { customer: customerId }
    );
  }

  async createSubscription(params: Stripe.SubscriptionCreateParams) {
    return this.stripe.subscriptions.create(params);
  }

  async retrieveSubscription(id: string) {
    return this.stripe.subscriptions.retrieve(id);
  }

  async cancelSubscription(id: string) {
    return this.stripe.subscriptions.cancel(id);
  }

  async createPayout(params: Stripe.PayoutCreateParams) {
    return this.stripe.payouts.create(params);
  }

  async retrievePayout(id: string) {
    return this.stripe.payouts.retrieve(id);
  }

  async createTransfer(params: Stripe.TransferCreateParams) {
    return this.stripe.transfers.create(params);
  }

  async retrieveTransfer(id: string) {
    return this.stripe.transfers.retrieve(id);
  }

  async createAccount(params: Stripe.AccountCreateParams) {
    return this.stripe.accounts.create(params);
  }

  async retrieveAccount(id: string) {
    return this.stripe.accounts.retrieve(id);
  }

  async createExternalAccount(accountId: string, params: Stripe.ExternalAccountCreateParams) {
    return this.stripe.accounts.createExternalAccount(accountId, params);
  }
}

export const stripeService = new StripeService();
