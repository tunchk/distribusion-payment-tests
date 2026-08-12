import { APIRequestContext, APIResponse } from '@playwright/test';

export class PaymentApiClient {
  constructor(private readonly request: APIRequestContext) {}

  createPaymentMethod(body: unknown): Promise<APIResponse> {
    return this.request.post('/payment-methods', { data: body });
  }

  getPaymentMethod(id: string): Promise<APIResponse> {
    return this.request.get(`/payment-methods/${id}`);
  }

  listPaymentsByPaymentMethod(id: string): Promise<APIResponse> {
    return this.request.get(`/payment-methods/${id}/payments`);
  }

  createPayment(body: unknown): Promise<APIResponse> {
    return this.request.post('/payments', { data: body });
  }

  getPayment(id: string): Promise<APIResponse> {
    return this.request.get(`/payments/${id}`);
  }
}
