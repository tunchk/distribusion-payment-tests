import { expect, test } from '@playwright/test';
import { PaymentApiClient } from '../src/client/payment-api.client';
import {
  cardPaymentMethod,
  declineCardPaymentMethod,
  declineSepaPaymentMethod,
  invalidPaymentAmount,
  negativePaymentAmount,
  sepaPaymentMethod,
  successfulPayment,
  supportedCurrencies,
  unknownPaymentMethodId,
  unsupportedCurrency,
} from '../src/data/test-data';
import { expectApiError } from '../src/helpers/expect-api-error';
import { isApiLoggingEnabled } from '../src/helpers/logger';
import {
  createActivePaymentMethod,
  createAndWaitForPayment,
} from '../src/helpers/payment-lifecycle';

test('creates a successful payment', {
  tag: ['@regression', '@smoke', '@contract', '@e2e'],
}, async ({ request }, testInfo) => {
  const client = new PaymentApiClient(request);

  const { active: activeMethod } = await createActivePaymentMethod(client, {
    type: 'adyen',
    card: cardPaymentMethod,
  });

  const { payment } = await createAndWaitForPayment(client, {
    payment_method_id: activeMethod.id,
    amount: successfulPayment.amount,
    currency: successfulPayment.currency,
  });

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

test('card decline flow', {
  tag: ['@regression', '@smoke', '@contract', '@negative', '@e2e'],
}, async ({ request }) => {
  const client = new PaymentApiClient(request);

  const { created: createdMethod, active: activeMethod } =
    await createActivePaymentMethod(client, {
      type: 'adyen',
      card: declineCardPaymentMethod,
    });

  expect(createdMethod.status).toBe('processing');

  const { payment } = await createAndWaitForPayment(client, {
    payment_method_id: activeMethod.id,
    amount: 1000,
    currency: 'EUR',
  });

  expect(payment.status).toBe('failed');
  expect(payment.failure_reason).toBe('card_declined');
  expect(payment.payment_method_id).toBe(activeMethod.id);
  expect(payment.amount).toBe(1000);
  expect(payment.currency).toBe('EUR');
});

test('SEPA decline flow', {
  tag: ['@regression', '@smoke', '@contract', '@negative', '@e2e'],
}, async ({ request }) => {
  const client = new PaymentApiClient(request);

  const { created: createdMethod, active: activeMethod } =
    await createActivePaymentMethod(client, {
      type: 'sepa',
      sepa: declineSepaPaymentMethod,
    });

  expect(createdMethod.status).toBe('processing');

  const { payment } = await createAndWaitForPayment(client, {
    payment_method_id: activeMethod.id,
    amount: 1000,
    currency: 'EUR',
  });

  expect(payment.status).toBe('failed');
  expect(payment.failure_reason).toBe('debit_declined');
  expect(payment.payment_method_id).toBe(activeMethod.id);
  expect(payment.amount).toBe(1000);
  expect(payment.currency).toBe('EUR');
});

test('payment list is returned oldest first', {
  tag: ['@regression', '@contract'],
}, async ({ request }, testInfo) => {
  const client = new PaymentApiClient(request);

  const { active: activeMethod } = await createActivePaymentMethod(client, {
    type: 'adyen',
    card: cardPaymentMethod,
  });

  const { created: createdPaymentA, payment: paymentA } =
    await createAndWaitForPayment(client, {
      payment_method_id: activeMethod.id,
      amount: 1000,
      currency: 'EUR',
    });

  expect(paymentA.status).toBe('succeeded');

  const { created: createdPaymentB, payment: paymentB } =
    await createAndWaitForPayment(client, {
      payment_method_id: activeMethod.id,
      amount: 2000,
      currency: 'EUR',
    });

  expect(paymentB.status).toBe('succeeded');

  const listResponse = await client.listPaymentsByPaymentMethod(activeMethod.id);

  expect(listResponse.status()).toBe(200);
  const body = await listResponse.json();
  expect(Array.isArray(body.data)).toBe(true);

  const listedA = body.data.find(
    (payment: { amount: number }) => payment.amount === 1000,
  );
  const listedB = body.data.find(
    (payment: { amount: number }) => payment.amount === 2000,
  );
  const listedAIndex = body.data.findIndex(
    (payment: { amount: number }) => payment.amount === 1000,
  );
  const listedBIndex = body.data.findIndex(
    (payment: { amount: number }) => payment.amount === 2000,
  );

  await testInfo.attach('payment-list-identity-context', {
    body: JSON.stringify(
      {
        createdPaymentAId: createdPaymentA.id,
        listedPaymentAId: listedA?.id,
        createdPaymentBId: createdPaymentB.id,
        listedPaymentBId: listedB?.id,
        createdPaymentACreatedAt: paymentA.created_at,
        listedPaymentACreatedAt: listedA?.created_at,
        createdPaymentBCreatedAt: paymentB.created_at,
        listedPaymentBCreatedAt: listedB?.created_at,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });

  expect.soft(listedA).toBeTruthy();
  expect.soft(listedB).toBeTruthy();

  const ids = body.data.map((payment: { id: string }) => payment.id);
  expect.soft(ids).toContain(createdPaymentA.id);
  expect.soft(ids).toContain(createdPaymentB.id);
  expect.soft(listedA?.id).toBe(createdPaymentA.id);
  expect.soft(listedB?.id).toBe(createdPaymentB.id);

  for (let i = 1; i < body.data.length; i++) {
    const previousCreatedAt = new Date(body.data[i - 1].created_at).getTime();
    const currentCreatedAt = new Date(body.data[i].created_at).getTime();
    expect
      .soft(previousCreatedAt)
      .toBeLessThanOrEqual(currentCreatedAt);
  }

  expect.soft(listedAIndex).not.toBe(-1);
  expect.soft(listedBIndex).not.toBe(-1);
  expect.soft(listedAIndex).toBeLessThan(listedBIndex);

  if (listedA?.created_at && listedB?.created_at) {
    expect
      .soft(new Date(listedA.created_at).getTime())
      .toBeLessThanOrEqual(new Date(listedB.created_at).getTime());
  }

  expect.soft(listedA?.payment_method_id).toBe(activeMethod.id);
  expect.soft(listedA?.amount).toBe(1000);
  expect.soft(listedA?.currency).toBe('EUR');

  expect.soft(listedB?.payment_method_id).toBe(activeMethod.id);
  expect.soft(listedB?.amount).toBe(2000);
  expect.soft(listedB?.currency).toBe('EUR');
});

test.describe('payment validation', () => {
  test('invalid payment amount', {
    tag: ['@regression', '@contract', '@negative'],
  }, async ({ request }) => {
    const client = new PaymentApiClient(request);
    const { active: activeMethod } = await createActivePaymentMethod(client, {
      type: 'adyen',
      card: cardPaymentMethod,
    });

    const response = await client.createPayment({
      payment_method_id: activeMethod.id,
      amount: invalidPaymentAmount,
      currency: 'EUR',
    });

    await expectApiError(response, 422, 'invalid_amount');
  });

  test('unsupported currency', {
    tag: ['@regression', '@contract', '@negative'],
  }, async ({ request }) => {
    const client = new PaymentApiClient(request);
    const { active: activeMethod } = await createActivePaymentMethod(client, {
      type: 'adyen',
      card: cardPaymentMethod,
    });

    const response = await client.createPayment({
      payment_method_id: activeMethod.id,
      amount: 1000,
      currency: unsupportedCurrency,
    });

    await expectApiError(response, 422, 'unsupported_currency');
  });

  test('unknown payment method', {
    tag: ['@regression', '@contract', '@negative'],
  }, async ({ request }) => {
    const client = new PaymentApiClient(request);

    const response = await client.createPayment({
      payment_method_id: unknownPaymentMethodId,
      amount: 1000,
      currency: 'EUR',
    });

    await expectApiError(response, 422, 'unknown_payment_method');
  });

  test('minimum valid amount', {
    tag: ['@regression', '@contract'],
  }, async ({ request }) => {
    const client = new PaymentApiClient(request);
    const { active: activeMethod } = await createActivePaymentMethod(client, {
      type: 'adyen',
      card: cardPaymentMethod,
    });

    const { payment } = await createAndWaitForPayment(client, {
      payment_method_id: activeMethod.id,
      amount: 1,
      currency: 'EUR',
    });

    expect(payment.status).toBe('succeeded');
    expect(payment.amount).toBe(1);
    expect(payment.currency).toBe('EUR');
  });

  test('negative amount', {
    tag: ['@regression', '@contract', '@negative'],
  }, async ({ request }) => {
    const client = new PaymentApiClient(request);
    const { active: activeMethod } = await createActivePaymentMethod(client, {
      type: 'adyen',
      card: cardPaymentMethod,
    });

    const response = await client.createPayment({
      payment_method_id: activeMethod.id,
      amount: negativePaymentAmount,
      currency: 'EUR',
    });

    await expectApiError(response, 422, 'invalid_amount');
  });

  test('non-integer amount', {
    tag: ['@regression', '@contract', '@negative'],
  }, async ({ request }) => {
    const client = new PaymentApiClient(request);
    const { active: activeMethod } = await createActivePaymentMethod(client, {
      type: 'adyen',
      card: cardPaymentMethod,
    });

    const response = await client.createPayment({
      payment_method_id: activeMethod.id,
      amount: '1000',
      currency: 'EUR',
    } as unknown);

    await expectApiError(response, 422, 'invalid_amount');
  });
});

for (const currency of supportedCurrencies) {
  test(`creates a successful payment with ${currency}`, {
    tag: ['@regression', '@contract'],
  }, async ({ request }) => {
    const client = new PaymentApiClient(request);
    const { active: activeMethod } = await createActivePaymentMethod(client, {
      type: 'adyen',
      card: cardPaymentMethod,
    });

    const { payment } = await createAndWaitForPayment(client, {
      payment_method_id: activeMethod.id,
      amount: 1000,
      currency,
    });

    expect(payment.status).toBe('succeeded');
    expect(payment.currency).toBe(currency);
  });
}

test('successful Checkout payment', {
  tag: ['@regression', '@contract', '@e2e'],
}, async ({ request }) => {
  const client = new PaymentApiClient(request);

  const { active: activeMethod } = await createActivePaymentMethod(client, {
    type: 'checkout',
    card: cardPaymentMethod,
  });

  const { payment } = await createAndWaitForPayment(client, {
    payment_method_id: activeMethod.id,
    amount: 1000,
    currency: 'EUR',
  });

  expect(payment.status).toBe('succeeded');
  expect(payment.payment_method_id).toBe(activeMethod.id);
  expect(payment.amount).toBe(1000);
  expect(payment.currency).toBe('EUR');
});

test('successful SEPA payment', {
  tag: ['@regression', '@contract', '@e2e'],
}, async ({ request }) => {
  const client = new PaymentApiClient(request);

  const { active: activeMethod } = await createActivePaymentMethod(client, {
    type: 'sepa',
    sepa: sepaPaymentMethod,
  });

  const { payment } = await createAndWaitForPayment(client, {
    payment_method_id: activeMethod.id,
    amount: 1000,
    currency: 'EUR',
  });

  expect(payment.status).toBe('succeeded');
  expect(payment.payment_method_id).toBe(activeMethod.id);
  expect(payment.amount).toBe(1000);
  expect(payment.currency).toBe('EUR');
});

test('empty payment list', {
  tag: ['@regression', '@contract'],
}, async ({ request }) => {
  const client = new PaymentApiClient(request);

  const { active: activeMethod } = await createActivePaymentMethod(client, {
    type: 'adyen',
    card: cardPaymentMethod,
  });

  const listResponse = await client.listPaymentsByPaymentMethod(activeMethod.id);

  expect(listResponse.status()).toBe(200);
  const body = await listResponse.json();
  expect(Array.isArray(body.data)).toBe(true);
  expect(body.data).toEqual([]);
});
