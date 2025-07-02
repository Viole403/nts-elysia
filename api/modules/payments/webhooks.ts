import { Elysia, Context } from 'elysia';
import { PaymentService } from './service';

export const paymentWebhooksModule = new Elysia()
  .group('/payments/webhooks', (app) =>
    app
      .post('/local-payment', async (ctx: Context) => {
        await PaymentService.handleLocalPaymentNotification(ctx.body);
        return { message: 'OK' };
      })
      .post('/stripe', async (ctx: Context) => {
        const rawBody = await ctx.request.text();
        const signature = ctx.headers['stripe-signature'];

        if (!signature) {
          ctx.set.status = 400;
          return { message: 'Stripe-Signature header missing' };
        }

        try {
          await PaymentService.handleStripeWebhook(rawBody, signature);
          return { received: true };
        } catch (error: any) {
          console.error('Stripe webhook error:', error.message);
          ctx.set.status = 400;
          return { message: `Webhook Error: ${error.message}` };
        }
      })
      .post('/paypal', async (ctx: Context) => {
        const headers = ctx.headers;
        try {
          await PaymentService.handlePayPalWebhook(ctx.body, headers);
          return { message: 'OK' };
        } catch (error: any) {
          console.error('PayPal webhook error:', error.message);
          ctx.set.status = 400;
          return { message: `Webhook Error: ${error.message}` };
        }
      })
      .post('/crypto', async (ctx: Context) => {
        const signature = ctx.headers['x-crypto-signature'];
        if (!signature) {
          ctx.set.status = 400;
          return { message: 'X-Crypto-Signature header missing' };
        }
        try {
          await PaymentService.handleCryptoWebhook(ctx.body, signature);
          return { message: 'OK' };
        } catch (error: any) {
          console.error('Crypto webhook error:', error.message);
          ctx.set.status = 400;
          return { message: `Webhook Error: ${error.message}` };
        }
      })
      .post('/amazon', async (ctx: Context) => {
        try {
          await PaymentService.handleAmazonWebhook(ctx.body);
          return { message: 'OK' };
        } catch (error: any) {
          console.error('Amazon webhook error:', error.message);
          ctx.set.status = 400;
          return { message: `Webhook Error: ${error.message}` };
        }
      })
      .post('/apple', async (ctx: Context) => {
        try {
          await PaymentService.handleAppleWebhook(ctx.body);
          return { message: 'OK' };
        } catch (error: any) {
          console.error('Apple webhook error:', error.message);
          ctx.set.status = 400;
          return { message: `Webhook Error: ${error.message}` };
        }
      })
      .post('/google', async (ctx: Context) => {
        try {
          await PaymentService.handleGoogleWebhook(ctx.body);
          return { message: 'OK' };
        } catch (error: any) {
          console.error('Google webhook error:', error.message);
          ctx.set.status = 400;
          return { message: `Webhook Error: ${error.message}` };
        }
      })
  );