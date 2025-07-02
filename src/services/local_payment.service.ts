
import { LocalPaymentProvider } from '@prisma/client';

interface LocalPaymentService {
  createPayment(params: any): Promise<any>;
  handleNotification(notificationData: any): Promise<any>;
  getTransactionStatus(id: string): Promise<any>;
  createPayout(params: any): Promise<any>;
  getPayoutStatus(id: string): Promise<any>;
}

class LocalPaymentServiceFacade implements LocalPaymentService {
  private activeService: any;
  public provider: LocalPaymentProvider;

  constructor() {
    const provider = (process.env.LOCAL_PAYMENT_PROVIDER || 'MIDTRANS') as LocalPaymentProvider;
    this.provider = provider;

    (async () => {
      switch (provider) {
        case LocalPaymentProvider.MIDTRANS:
          const midtransModule = await import('./local_payment_providers/midtrans.service');
          this.activeService = midtransModule.midtransService;
          break;
        case LocalPaymentProvider.XENDIT:
          const xenditModule = await import('./local_payment_providers/xendit.service');
          this.activeService = xenditModule.xenditService;
          break;
        case LocalPaymentProvider.DOKU:
          const dokuModule = await import('./local_payment_providers/doku.service');
          this.activeService = dokuModule.dokuService;
          break;
        case LocalPaymentProvider.FASPAY:
          const faspayModule = await import('./local_payment_providers/faspay.service');
          this.activeService = faspayModule.faspayService;
          break;
        default:
          throw new Error(`Unsupported local payment provider: ${provider}`);
      }
    })();
  }

  private async ensureServiceInitialized() {
    if (!this.activeService) {
      // Wait for a short period to allow the async import in the constructor to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!this.activeService) {
        throw new Error('Local payment service not initialized.');
      }
    }
  }

  async createPayment(params: any): Promise<any> {
    await this.ensureServiceInitialized();
    return this.activeService.createPayment(params);
  }

  async handleNotification(notificationData: any): Promise<any> {
    await this.ensureServiceInitialized();
    return this.activeService.handleNotification(notificationData);
  }

  async getTransactionStatus(id: string): Promise<any> {
    await this.ensureServiceInitialized();
    return this.activeService.getTransactionStatus(id);
  }

  async createPayout(params: any): Promise<any> {
    await this.ensureServiceInitialized();
    // Assuming all local payment providers have a createPayout method
    if ('createPayout' in this.activeService) {
      return (this.activeService as any).createPayout(params);
    } else {
      throw new Error(`Payouts not supported by ${this.provider}`);
    }
  }

  async getPayoutStatus(id: string): Promise<any> {
    await this.ensureServiceInitialized();
    // Assuming all local payment providers have a getPayoutStatus method
    if ('getPayoutStatus' in this.activeService) {
      return (this.activeService as any).getPayoutStatus(id);
    } else {
      throw new Error(`Payout status not supported by ${this.provider}`);
    }
  }
}

export const localPaymentService = new LocalPaymentServiceFacade();
