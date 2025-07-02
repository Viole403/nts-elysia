import midtransClient from 'midtrans-client';

export class MidtransService {
  private snap: midtransClient.Snap;
  private coreApi: midtransClient.CoreApi;
  private iris: midtransClient.Iris;

  constructor() {
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
    this.snap = new midtransClient.Snap({
      isProduction,
      serverKey: process.env.MIDTRANS_SERVER_KEY || '',
      clientKey: process.env.MIDTRANS_CLIENT_KEY || '',
    });
    this.coreApi = new midtransClient.CoreApi({
      isProduction,
      serverKey: process.env.MIDTRANS_SERVER_KEY || '',
      clientKey: process.env.MIDTRANS_CLIENT_KEY || '',
    });
    this.iris = new midtransClient.Iris({
      isProduction,
      irisKey: process.env.MIDTRANS_IRIS_KEY || '',
    });
  }

  async createPayment(params: any) {
    // Midtrans has two main payment flows: Snap (redirect) and Core API (direct charge)
    // This method will act as a facade, choosing the appropriate method based on params
    if (params.transaction_details && params.customer_details) {
      // Assuming Snap transaction if both transaction_details and customer_details are present
      const snapResponse = await this.createSnapTransaction(params);
      return { ...snapResponse, payment_instructions: 'Follow the redirect to complete payment.' };
    } else if (params.payment_type) {
      // Assuming Core API charge if payment_type is specified
      const coreApiResponse = await this.createCoreApiCharge(params);
      return { ...coreApiResponse, payment_instructions: 'Payment processed directly.' };
    } else {
      throw new Error('Invalid parameters for Midtrans createPayment');
    }
  }

  async createSnapTransaction(params: any) {
    return this.snap.createTransaction(params);
  }

  async createCoreApiCharge(params: any) {
    return this.coreApi.charge(params);
  }

  async getTransactionStatus(orderId: string) {
    return this.coreApi.transaction.status(orderId);
  }

  async handleNotification(notificationData: any) {
    return this.snap.transaction.notification(notificationData);
  }

  async createPayout(params: any) {
    return this.iris.createPayout(params);
  }

  async getPayoutStatus(referenceNo: string) {
    return this.iris.getPayoutDetails(referenceNo);
  }
}

export const midtransService = new MidtransService();
