import { expect, test } from '@playwright/test';
import { PaymentApiClient } from '../src/client/payment-api.client';
import { cardPaymentMethod, successfulPayment } from '../src/data/test-data';
import { poll } from '../src/helpers/poll';

test('creates a successful payment', async ({ request }) => {
  const client = new PaymentApiClient(request);

  const createMethodResponse = await client.createPaymentMethod({
    type: 'adyen',
    card: cardPaymentMethod,
  });

  expect(createMethodResponse.status()).toBe(201);
  const createdMethod = await createMethodResponse.json();

  const activeMethod = await poll(
    async () => {
      const response = await client.getPaymentMethod(createdMethod.id);
      expect(response.status()).toBe(200);
      return response.json();
    },
    (paymentMethod) => paymentMethod.status === 'active',
    {
      description: `payment method ${createdMethod.id} to become active`,
    },
  );

  const createPaymentResponse = await client.createPayment({
    payment_method_id: activeMethod.id,
    amount: successfulPayment.amount,
    currency: successfulPayment.currency,
  });

  expect(createPaymentResponse.status()).toBe(201);
  const createdPayment = await createPaymentResponse.json();
  expect(createdPayment.status).toBe('processing');

  const payment = await poll(
    async () => {
      const response = await client.getPayment(createdPayment.id);
      expect(response.status()).toBe(200);
      return response.json();
    },
    (result) => result.status !== 'processing',
    {
      description: `payment ${createdPayment.id} to leave processing`,
    },
  );

  expect(payment.status).toBe('succeeded');
  expect(payment.payment_method_id).toBe(activeMethod.id);
  expect(payment.amount).toBe(successfulPayment.amount);
  expect(payment.currency).toBe(successfulPayment.currency);
  expect(payment.holder_name).toBe(cardPaymentMethod.holder_name);
});
