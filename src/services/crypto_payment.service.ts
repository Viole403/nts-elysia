import { coingateService } from './crypto_payment_providers/coingate.service';
import { coinbaseService } from './crypto_payment_providers/coinbase.service';
import { bitpayService } from './crypto_payment_providers/bitpay.service';
import { CryptoPaymentProvider } from '@prisma/client';

interface CryptoPaymentService {
  createPayment(amount: number, currency: string, userId: string, orderId: string): Promise<any>;
  getPaymentStatus(transactionId: string): Promise<any>;
  validateWebhook(payload: any, signature: string): Promise<boolean>;
  createPayout(amount: number, currency: string, beneficiaryAddress: string, userId: string, payoutId: string): Promise<any>;
  getPayoutStatus(payoutTransactionId: string): Promise<any>;
}

class CryptoPaymentServiceFacade implements CryptoPaymentService {
  private activeService: CryptoPaymentService;
  public provider: CryptoPaymentProvider;

  constructor() {
    const provider = (process.env.CRYPTO_PAYMENT_PROVIDER || 'COINGATE') as CryptoPaymentProvider;
    this.provider = provider;

    switch (provider) {
      case CryptoPaymentProvider.COINGATE:
        this.activeService = coingateService;
        break;
      case CryptoPaymentProvider.COINBASE:
        this.activeService = coinbaseService;
        break;
      case CryptoPaymentProvider.BITPAY:
        this.activeService = bitpayService;
        break;
      default:
        throw new Error(`Unsupported crypto payment provider: ${provider}`);
    }
  }

  async createPayment(amount: number, currency: string, userId: string, orderId: string): Promise<any> {
    return this.activeService.createPayment(amount, currency, userId, orderId);
  }

  async getPaymentStatus(transactionId: string): Promise<any> {
    return this.activeService.getPaymentStatus(transactionId);
  }

  async validateWebhook(payload: any, signature: string): Promise<boolean> {
    return this.activeService.validateWebhook(payload, signature);
  }

  async createPayout(amount: number, currency: string, beneficiaryAddress: string, userId: string, payoutId: string): Promise<any> {
    return this.activeService.createPayout(amount, currency, beneficiaryAddress, userId, payoutId);
  }

  async getPayoutStatus(payoutTransactionId: string): Promise<any> {
    return this.activeService.getPayoutStatus(payoutTransactionId);
  }
}

export const cryptoPaymentService = new CryptoPaymentServiceFacade();
