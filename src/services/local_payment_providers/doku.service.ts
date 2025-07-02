import Doku from 'doku-nodejs-library';

export class DokuService {
  private dokuClient: any;

  constructor() {
    // Initialize Doku client with your credentials
    // Replace with your actual Doku configuration
    this.dokuClient = new Doku({
      client_id: process.env.DOKU_CLIENT_ID || 'YOUR_DOKU_CLIENT_ID',
      shared_key: process.env.DOKU_SHARED_KEY || 'YOUR_DOKU_SHARED_KEY',
      // Add other necessary configurations like environment (sandbox/production)
    });
  }

  async createPayment(params: any) {
    console.log('Doku Payment: Creating payment with params:', params);
    // Example: Call Doku API to create a payment
    // This will vary based on the actual Doku SDK methods
    try {
      const response = await this.dokuClient.createPayment(params);
      return { ...response, payment_instructions: 'Follow the redirect to complete payment.' };
    } catch (error) {
      console.error('Error creating Doku payment:', error);
      throw error;
    }
  }

  async handleNotification(notificationData: any) {
    console.log('Doku Notification:', notificationData);
    // Example: Call Doku API to handle notification
    try {
      const response = await this.dokuClient.handleNotification(notificationData);
      return response;
    } catch (error) {
      console.error('Error handling Doku notification:', error);
      throw error;
    }
  }

  async getTransactionStatus(id: string) {
    console.log('Doku Get Status for:', id);
    // Example: Call Doku API to get transaction status
    try {
      const response = await this.dokuClient.getTransactionStatus(id);
      return response;
    } catch (error) {
      console.error('Error getting Doku transaction status:', error);
      throw error;
    }
  }

  async createPayout(params: any) {
    console.log('Doku Payout: Creating payout with params:', params);
    // Example: Call Doku API to create a payout
    try {
      const response = await this.dokuClient.createPayout(params);
      return response;
    } catch (error) {
      console.error('Error creating Doku payout:', error);
      throw error;
    }
  }

  async getPayoutStatus(id: string) {
    console.log('Doku Payout: Getting status for:', id);
    // Example: Call Doku API to get payout status
    try {
      const response = await this.dokuClient.getPayoutStatus(id);
      return response;
    } catch (error) {
      console.error('Error getting Doku payout status:', error);
      throw error;
    }
  }
}

export const dokuService = new DokuService();