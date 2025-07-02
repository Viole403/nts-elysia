declare module 'midtrans-client' {
  class Snap {
    constructor(options: {
      isProduction: boolean;
      serverKey: string;
      clientKey: string;
    });
    createTransaction(parameters: any): Promise<any>;
    transaction: {
      notification(notificationData: any): Promise<any>;
    };
  }

  class CoreApi {
    constructor(options: {
      isProduction: boolean;
      serverKey: string;
      clientKey: string;
    });
    charge(parameters: any): Promise<any>;
    transaction: {
      status(orderId: string): Promise<any>;
    };
  }

  class Iris {
    constructor(options: {
      isProduction: boolean;
      irisKey: string;
    });
    createPayout(parameters: any): Promise<any>;
    getPayoutDetails(referenceNo: string): Promise<any>;
  }
}