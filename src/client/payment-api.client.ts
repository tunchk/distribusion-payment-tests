import { APIRequestContext, APIResponse } from '@playwright/test';
import { logApiRequestAndResponse } from '../helpers/logger';

export class PaymentApiClient {
  constructor(private readonly request: APIRequestContext) {}

  private async execute(
    method: 'GET' | 'POST',
    path: string,
    requestBody?: unknown,
  ): Promise<APIResponse> {
    const response =
      method === 'GET'
        ? await this.request.get(path)
        : await this.request.post(path, { data: requestBody });

    await logApiRequestAndResponse({
      method,
      path,
      requestBody,
      response,
    });

    return response;
  }

  createPaymentMethod(body: unknown): Promise<APIResponse> {
    return this.execute('POST', '/payment-methods', body);
  }

  getPaymentMethod(id: string): Promise<APIResponse> {
    return this.execute('GET', `/payment-methods/${id}`);
  }

  listPaymentsByPaymentMethod(id: string): Promise<APIResponse> {
    return this.execute('GET', `/payment-methods/${id}/payments`);
  }

  createPayment(body: unknown): Promise<APIResponse> {
    return this.execute('POST', '/payments', body);
  }

  getPayment(id: string): Promise<APIResponse> {
    return this.execute('GET', `/payments/${id}`);
  }
}
