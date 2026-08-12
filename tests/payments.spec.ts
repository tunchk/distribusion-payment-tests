import { APIRequestContext, expect, test } from '@playwright/test';
import { PaymentApiClient } from '../src/client/payment-api.client';
import {
  cardPaymentMethod,
  declineCardPaymentMethod,
  declineSepaPaymentMethod,
  invalidPaymentAmount,
  successfulPayment,
  unknownPaymentMethodId,
  unsupportedCurrency,
} from '../src/data/test-data';
import { poll } from '../src/helpers/poll';
import { isApiLoggingEnabled } from '../src/helpers/logger';

async function createActiveAdyenPaymentMethod(request: APIRequestContext) {
  const client = new PaymentApiClient(request);

  const createMethodResponse = await client.createPaymentMethod({
    type: 'adyen',
    card: cardPaymentMethod,
  });

  expect(createMethodResponse.status()).toBe(201);
  const createdMethod = await createMethodResponse.json();

  return poll(
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
}

test('creates a successful payment', async ({ request }, testInfo) => {
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

  if (isApiLoggingEnabled()) {
    const context = `Payment method holder: ${cardPaymentMethod.holder_name}\nPayment holder: ${payment.holder_name}`;
    // eslint-disable-next-line no-console
    console.log(context);
    await testInfo.attach('payment-holder-context', {
      body: context,
      contentType: 'text/plain',
    });
  }

  expect(payment.holder_name).toBe(cardPaymentMethod.holder_name);
});

test('card decline flow', async ({ request }) => {
  const client = new PaymentApiClient(request);

  const createMethodResponse = await client.createPaymentMethod({
    type: 'adyen',
    card: declineCardPaymentMethod,
  });

  expect(createMethodResponse.status()).toBe(201);
  const createdMethod = await createMethodResponse.json();
  expect(createdMethod.status).toBe('processing');

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
    amount: 1000,
    currency: 'EUR',
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

  expect(payment.status).toBe('failed');
  expect(payment.failure_reason).toBe('card_declined');
  expect(payment.payment_method_id).toBe(activeMethod.id);
  expect(payment.amount).toBe(1000);
  expect(payment.currency).toBe('EUR');
});

test('SEPA decline flow', async ({ request }) => {
  const client = new PaymentApiClient(request);

  const createMethodResponse = await client.createPaymentMethod({
    type: 'sepa',
    sepa: declineSepaPaymentMethod,
  });

  expect(createMethodResponse.status()).toBe(201);
  const createdMethod = await createMethodResponse.json();
  expect(createdMethod.status).toBe('processing');

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
    amount: 1000,
    currency: 'EUR',
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

  expect(payment.status).toBe('failed');
  expect(payment.failure_reason).toBe('debit_declined');
  expect(payment.payment_method_id).toBe(activeMethod.id);
  expect(payment.amount).toBe(1000);
  expect(payment.currency).toBe('EUR');
});

test.describe('payment validation', () => {
  test('invalid payment amount', async ({ request }) => {
    const client = new PaymentApiClient(request);
    const activeMethod = await createActiveAdyenPaymentMethod(request);

    const response = await client.createPayment({
      payment_method_id: activeMethod.id,
      amount: invalidPaymentAmount,
      currency: 'EUR',
    });

    expect(response.status()).toBe(422);
    const body = await response.json();
    expect(body.error).toBeTruthy();
    expect(body.error.code).toBe('invalid_amount');
    expect(body.error.message).toBeTruthy();
    expect(body.error.message.length).toBeGreaterThan(0);
  });

  test('unsupported currency', async ({ request }) => {
    const client = new PaymentApiClient(request);
    const activeMethod = await createActiveAdyenPaymentMethod(request);

    const response = await client.createPayment({
      payment_method_id: activeMethod.id,
      amount: 1000,
      currency: unsupportedCurrency,
    });

    expect(response.status()).toBe(422);
    const body = await response.json();
    expect(body.error).toBeTruthy();
    expect(body.error.code).toBe('unsupported_currency');
    expect(body.error.message).toBeTruthy();
    expect(body.error.message.length).toBeGreaterThan(0);
  });

  test('unknown payment method', async ({ request }) => {
    const client = new PaymentApiClient(request);

    const response = await client.createPayment({
      payment_method_id: unknownPaymentMethodId,
      amount: 1000,
      currency: 'EUR',
    });

    expect(response.status()).toBe(422);
    const body = await response.json();
    expect(body.error).toBeTruthy();
    expect(body.error.code).toBe('unknown_payment_method');
    expect(body.error.message).toBeTruthy();
    expect(body.error.message.length).toBeGreaterThan(0);
  });
});
