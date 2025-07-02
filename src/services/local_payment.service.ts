import { midtransService } from './local_payment_providers/midtrans.service';
import { xenditService } from './local_payment_providers/xendit.service';
import { dokuService } from './local_payment_providers/doku.service';
import { faspayService } from './local_payment_providers/faspay.service';
import { LocalPaymentProvider } from '@prisma/client';

interface LocalPaymentService {
  createPayment(params: any): Promise<any>;
  handleNotification(notificationData: any): Promise<any>;
  getTransactionStatus(id: string): Promise<any>;
  createPayout(params: any): Promise<any>;
  getPayoutStatus(id: string): Promise<any>;
}

class LocalPaymentServiceFacade implements LocalPaymentService {
  private activeService: LocalPaymentService;
  public provider: LocalPaymentProvider;

  constructor() {
    const provider = (process.env.LOCAL_PAYMENT_PROVIDER || 'MIDTRANS') as LocalPaymentProvider;
    this.provider = provider;

    switch (provider) {
      case LocalPaymentProvider.MIDTRANS:
        this.activeService = midtransService;
        break;
      case LocalPaymentProvider.XENDIT:
        this.activeService = xenditService;
        break;
      case LocalPaymentProvider.DOKU:
        this.activeService = dokuService;
        break;
      case LocalPaymentProvider.FASPAY:
        this.activeService = faspayService;
        break;

      default:
        throw new Error(`Unsupported local payment provider: ${provider}`);
    }
  }

  async createPayment(params: any): Promise<any> {
    return this.activeService.createPayment(params);
  }

  async handleNotification(notificationData: any): Promise<any> {
    return this.activeService.handleNotification(notificationData);
  }

  async getTransactionStatus(id: string): Promise<any> {
    return this.activeService.getTransactionStatus(id);
  }

  async createPayout(params: any): Promise<any> {
    // Assuming all local payment providers have a createPayout method
    if ('createPayout' in this.activeService) {
      return (this.activeService as any).createPayout(params);
    } else {
      throw new Error(`Payouts not supported by ${this.provider}`);
    }
  }

  async getPayoutStatus(id: string): Promise<any> {
    // Assuming all local payment providers have a getPayoutStatus method
    if ('getPayoutStatus' in this.activeService) {
      return (this.activeService as any).getPayoutStatus(id);
    } else {
      throw new Error(`Payout status not supported by ${this.provider}`);
    }
  }
}

export const localPaymentService = new LocalPaymentServiceFacade();
