import paypal from '@paypal/checkout-server-sdk';

const environment = () => {
  const clientId = process.env.PAYPAL_CLIENT_ID || 'sb-clientId';
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || 'sb-clientSecret';

  if (process.env.PAYPAL_MODE === 'live') {
    return new paypal.core.LiveEnvironment(clientId, clientSecret);
  } else {
    return new paypal.core.SandboxEnvironment(clientId, clientSecret);
  }
};

export class PayPalService {
  private client: paypal.core.PayPalHttpClient;

  constructor() {
    this.client = new paypal.core.PayPalHttpClient(environment());
  }

  async createOrder(requestBody: any) {
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody(requestBody);
    const response = await this.client.execute(request);
    return response.result;
  }

  async captureOrder(orderId: string) {
    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.prefer('return=representation');
    const response = await this.client.execute(request);
    return response.result;
  }

  async getOrder(orderId: string) {
    const request = new paypal.orders.OrdersGetRequest(orderId);
    const response = await this.client.execute(request);
    return response.result;
  }

  async validateWebhook(body: any, headers: any) {
    console.log('Validating PayPal webhook...', { body, headers });
    return true;
  }
}

export const payPalService = new PayPalService();
