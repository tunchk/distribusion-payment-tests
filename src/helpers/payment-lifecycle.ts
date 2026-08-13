import { expect } from '@playwright/test';

import { PaymentApiClient } from '../client/payment-api.client';
import { expectProcessingResource } from './expect-contract';
import { poll } from './poll';

export async function createActivePaymentMethod(
  client: PaymentApiClient,
  payload: unknown,
) {
  const createResponse = await client.createPaymentMethod(payload);

  expect(createResponse.status()).toBe(201);
  const created = await createResponse.json();
  expectProcessingResource(created);

  const active = await poll(
    async () => {
      const response = await client.getPaymentMethod(created.id);
      expect(response.status()).toBe(200);
      return response.json();
    },
    (paymentMethod) => paymentMethod.status === 'active',
    {
      description: `payment method ${created.id} to become active`,
    },
  );

  return { created, active };
}

export async function createAndWaitForPayment(
  client: PaymentApiClient,
  payload: unknown,
) {
  const createResponse = await client.createPayment(payload);

  expect(createResponse.status()).toBe(201);
  const created = await createResponse.json();
  expectProcessingResource(created);

  const payment = await poll(
    async () => {
      const response = await client.getPayment(created.id);
      expect(response.status()).toBe(200);
      return response.json();
    },
    (result) => result.status !== 'processing',
    {
      description: `payment ${created.id} to leave processing`,
    },
  );

  return { created, payment };
}
