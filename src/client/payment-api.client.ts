import { APIRequestContext, APIResponse } from '@playwright/test';
import { logApiRequestAndResponse } from '../helpers/logger';

export class PaymentApiClient {
  constructor(private readonly request: APIRequestContext) {}

  async createPaymentMethod(body: unknown): Promise<APIResponse> {
    const response = await this.request.post('/payment-methods', { data: body });

    await logApiRequestAndResponse({
      method: 'POST',
      path: '/payment-methods',
      requestBody: body,
      response,
    });

    return response;
  }

  async getPaymentMethod(id: string): Promise<APIResponse> {
    const response = await this.request.get(`/payment-methods/${id}`);

    await logApiRequestAndResponse({
      method: 'GET',
      path: `/payment-methods/${id}`,
      response,
    });

    return response;
  }

  async listPaymentsByPaymentMethod(id: string): Promise<APIResponse> {
    const response = await this.request.get(`/payment-methods/${id}/payments`);

    await logApiRequestAndResponse({
      method: 'GET',
      path: `/payment-methods/${id}/payments`,
      response,
    });

    return response;
  }

  async createPayment(body: unknown): Promise<APIResponse> {
    const response = await this.request.post('/payments', { data: body });

    await logApiRequestAndResponse({
      method: 'POST',
      path: '/payments',
      requestBody: body,
      response,
    });

    return response;
  }

  async getPayment(id: string): Promise<APIResponse> {
    const response = await this.request.get(`/payments/${id}`);

    await logApiRequestAndResponse({
      method: 'GET',
      path: `/payments/${id}`,
      response,
    });

    return response;
  }
}
