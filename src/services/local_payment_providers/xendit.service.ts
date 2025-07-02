import Xendit from 'xendit-node';

export class XenditService {
  private xenditClient: any;

  constructor() {
    // Initialize Xendit client with your API Key
    // Replace with your actual Xendit configuration
    this.xenditClient = new Xendit({
      secretKey: process.env.XENDIT_SECRET_KEY || 'YOUR_XENDIT_SECRET_KEY',
    });
  }

  async createPayment(params: any) {
    console.log('Xendit Payment: Creating payment with params:', params);
    // Example: Call Xendit API to create a payment (e.g., Invoice, Virtual Account)
    try {
      const response = await this.xenditClient.Invoice.createInvoice(params);
      return { ...response, payment_instructions: 'Follow the redirect to complete payment.' };
    } catch (error) {
      console.error('Error creating Xendit payment:', error);
      throw error;
    }
  }

  async handleNotification(notificationData: any) {
    console.log('Xendit Notification:', notificationData);
    // Example: Xendit webhooks typically contain a header for verification
    // You would verify the webhook signature here if needed
    return { status: 'SUCCESS' };
  }

  async getTransactionStatus(id: string) {
    console.log('Xendit Get Status for:', id);
    // Example: Call Xendit API to get transaction status (e.g., Invoice by ID)
    try {
      const response = await this.xenditClient.Invoice.getInvoice({ invoiceID: id });
      return response;
    } catch (error) {
      console.error('Error getting Xendit transaction status:', error);
      throw error;
    }
  }

  async createPayout(params: any) {
    console.log('Xendit Payout: Creating payout with params:', params);
    // Example: Call Xendit API to create a disbursement
    try {
      const response = await this.xenditClient.Disbursement.createDisbursement(params);
      return response;
    } catch (error) {
      console.error('Error creating Xendit payout:', error);
      throw error;
    }
  }

  async getPayoutStatus(id: string) {
    console.log('Xendit Payout: Getting status for:', id);
    // Example: Call Xendit API to get disbursement status
    try {
      const response = await this.xenditClient.Disbursement.getDisbursement({ disbursementID: id });
      return response;
    } catch (error) {
      console.error('Error getting Xendit payout status:', error);
      throw error;
    }
  }
}

export const xenditService = new XenditService();