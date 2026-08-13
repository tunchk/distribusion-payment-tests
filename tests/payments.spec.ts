import { expect, test } from '@playwright/test';
import { PaymentApiClient } from '../src/client/payment-api.client';
import {
  validCardDetails,
  declinedCardDetails,
  declinedSepaDetails,
  invalidPaymentAmount,
  negativePaymentAmount,
  validSepaDetails,
  validPayment,
  supportedCurrencies,
  nonexistentPaymentMethodId,
  unsupportedCurrency,
} from '../src/data/test-data';
import { expectApiError } from '../src/helpers/expect-api-error';
import {
  expectPayment,
  expectPaymentListWrapper,
} from '../src/helpers/expect-contract';
import { isApiLoggingEnabled } from '../src/helpers/logger';
import {
  createActivePaymentMethod,
  createAndWaitForPayment,
} from '../src/helpers/payment-lifecycle';

test('creates a successful Adyen payment', {
  tag: ['@regression', '@smoke', '@contract', '@e2e'],
}, async ({ request }, testInfo) => {
  const client = new PaymentApiClient(request);

  const { active: activeMethod } = await createActivePaymentMethod(client, {
    type: 'adyen',
    card: validCardDetails,
  });

  const { payment } = await createAndWaitForPayment(client, {
    payment_method_id: activeMethod.id,
    amount: validPayment.amount,
    currency: validPayment.currency,
  });

  expectPayment(payment, { status: 'succeeded' });
  expect(payment.payment_method_id).toBe(activeMethod.id);
  expect(payment.amount).toBe(validPayment.amount);
  expect(payment.currency).toBe(validPayment.currency);

  if (isApiLoggingEnabled()) {
    const context = `Payment method holder: ${validCardDetails.holder_name}\nPayment holder: ${payment.holder_name}`;
    // eslint-disable-next-line no-console
    console.log(context);
    await testInfo.attach('payment-holder-context', {
      body: context,
      contentType: 'text/plain',
    });
  }

  expect(payment.holder_name).toBe(validCardDetails.holder_name);
});

test('card decline flow', {
  tag: ['@regression', '@smoke', '@contract', '@negative', '@e2e'],
}, async ({ request }) => {
  const client = new PaymentApiClient(request);

  const { active: activeMethod } =
    await createActivePaymentMethod(client, {
      type: 'adyen',
      card: declinedCardDetails,
    });

  const { payment } = await createAndWaitForPayment(client, {
    payment_method_id: activeMethod.id,
    amount: 1000,
    currency: 'EUR',
  });

  expectPayment(payment, {
    status: 'failed',
    failureReason: 'card_declined',
  });
  expect(payment.payment_method_id).toBe(activeMethod.id);
  expect(payment.amount).toBe(1000);
  expect(payment.currency).toBe('EUR');
});

test('SEPA decline flow', {
  tag: ['@regression', '@smoke', '@contract', '@negative', '@e2e'],
}, async ({ request }) => {
  const client = new PaymentApiClient(request);

  const { active: activeMethod } =
    await createActivePaymentMethod(client, {
      type: 'sepa',
      sepa: declinedSepaDetails,
    });

  const { payment } = await createAndWaitForPayment(client, {
    payment_method_id: activeMethod.id,
    amount: 1000,
    currency: 'EUR',
  });

  expectPayment(payment, {
    status: 'failed',
    failureReason: 'debit_declined',
  });
  expect(payment.payment_method_id).toBe(activeMethod.id);
  expect(payment.amount).toBe(1000);
  expect(payment.currency).toBe('EUR');
});

test('payment list preserves identity and oldest-first ordering', {
  tag: ['@regression', '@contract'],
}, async ({ request }, testInfo) => {
  const client = new PaymentApiClient(request);

  const { active: activeMethod } = await createActivePaymentMethod(client, {
    type: 'adyen',
    card: validCardDetails,
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
  const listedPayments = expectPaymentListWrapper(body) as Array<{
    id: string;
    amount: number;
    currency: string;
    payment_method_id: string;
    created_at: string;
  }>;

  for (const item of listedPayments) {
    expectPayment(item, { status: 'succeeded' });
  }

  const listedA = listedPayments.find(
    (payment: { amount: number }) => payment.amount === 1000,
  );
  const listedB = listedPayments.find(
    (payment: { amount: number }) => payment.amount === 2000,
  );
  const listedAIndex = listedPayments.findIndex(
    (payment: { amount: number }) => payment.amount === 1000,
  );
  const listedBIndex = listedPayments.findIndex(
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

  const ids = listedPayments.map((payment: { id: string }) => payment.id);
  expect.soft(ids).toContain(createdPaymentA.id);
  expect.soft(ids).toContain(createdPaymentB.id);
  expect.soft(listedA?.id).toBe(createdPaymentA.id);
  expect.soft(listedB?.id).toBe(createdPaymentB.id);

  for (let i = 1; i < listedPayments.length; i++) {
    const previousCreatedAt = new Date(listedPayments[i - 1].created_at).getTime();
    const currentCreatedAt = new Date(listedPayments[i].created_at).getTime();
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
    tag: ['@regression', '@contract', '@negative', '@boundary'],
  }, async ({ request }) => {
    const client = new PaymentApiClient(request);
    const { active: activeMethod } = await createActivePaymentMethod(client, {
      type: 'adyen',
      card: validCardDetails,
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
      card: validCardDetails,
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
      payment_method_id: nonexistentPaymentMethodId,
      amount: 1000,
      currency: 'EUR',
    });

    await expectApiError(response, 422, 'unknown_payment_method');
  });

  test('minimum valid amount', {
    tag: ['@regression', '@contract', '@boundary'],
  }, async ({ request }) => {
    const client = new PaymentApiClient(request);
    const { active: activeMethod } = await createActivePaymentMethod(client, {
      type: 'adyen',
      card: validCardDetails,
    });

    const { payment } = await createAndWaitForPayment(client, {
      payment_method_id: activeMethod.id,
      amount: 1,
      currency: 'EUR',
    });

    expectPayment(payment, { status: 'succeeded' });
    expect(payment.amount).toBe(1);
    expect(payment.currency).toBe('EUR');
  });

  test('negative amount', {
    tag: ['@regression', '@contract', '@negative', '@boundary'],
  }, async ({ request }) => {
    const client = new PaymentApiClient(request);
    const { active: activeMethod } = await createActivePaymentMethod(client, {
      type: 'adyen',
      card: validCardDetails,
    });

    const response = await client.createPayment({
      payment_method_id: activeMethod.id,
      amount: negativePaymentAmount,
      currency: 'EUR',
    });

    await expectApiError(response, 422, 'invalid_amount');
  });

  test('non-integer amount', {
    tag: ['@regression', '@contract', '@negative', '@boundary'],
  }, async ({ request }) => {
    const client = new PaymentApiClient(request);
    const { active: activeMethod } = await createActivePaymentMethod(client, {
      type: 'adyen',
      card: validCardDetails,
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
      card: validCardDetails,
    });

    const { payment } = await createAndWaitForPayment(client, {
      payment_method_id: activeMethod.id,
      amount: 1000,
      currency,
    });

    expectPayment(payment, { status: 'succeeded' });
    expect(payment.currency).toBe(currency);
  });
}

test('creates a successful Checkout payment', {
  tag: ['@regression', '@contract', '@e2e'],
}, async ({ request }) => {
  const client = new PaymentApiClient(request);

  const { active: activeMethod } = await createActivePaymentMethod(client, {
    type: 'checkout',
    card: validCardDetails,
  });

  const { payment } = await createAndWaitForPayment(client, {
    payment_method_id: activeMethod.id,
    amount: 1000,
    currency: 'EUR',
  });

  expectPayment(payment, { status: 'succeeded' });
  expect(payment.payment_method_id).toBe(activeMethod.id);
  expect(payment.amount).toBe(1000);
  expect(payment.currency).toBe('EUR');
});

test('creates a successful SEPA payment', {
  tag: ['@regression', '@contract', '@e2e'],
}, async ({ request }) => {
  const client = new PaymentApiClient(request);

  const { active: activeMethod } = await createActivePaymentMethod(client, {
    type: 'sepa',
    sepa: validSepaDetails,
  });

  const { payment } = await createAndWaitForPayment(client, {
    payment_method_id: activeMethod.id,
    amount: 1000,
    currency: 'EUR',
  });

  expectPayment(payment, { status: 'succeeded' });
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
    card: validCardDetails,
  });

  const listResponse = await client.listPaymentsByPaymentMethod(activeMethod.id);

  expect(listResponse.status()).toBe(200);
  const body = await listResponse.json();
  const listedPayments = expectPaymentListWrapper(body);
  expect(listedPayments).toEqual([]);
});
