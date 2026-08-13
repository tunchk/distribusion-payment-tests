import { expect, test } from '@playwright/test';
import { PaymentApiClient } from '../src/client/payment-api.client';
import {
  validCardDetails,
  expiredCardPaymentMethod,
  invalidBic,
  invalidCvc,
  invalidHolderName,
  invalidIban,
  invalidLuhnCardNumber,
  validSepaDetails,
  validBic,
} from '../src/data/test-data';
import { expectApiError } from '../src/helpers/expect-api-error';
import { createActivePaymentMethod } from '../src/helpers/payment-lifecycle';

test.describe('payment methods', () => {
  for (const provider of ['adyen', 'checkout'] as const) {
    test(`creates a valid ${provider} card payment method`, {
      tag: ['@regression', '@smoke', '@contract'],
    }, async ({ request }) => {
      const client = new PaymentApiClient(request);

      const { created, active } = await createActivePaymentMethod(client, {
        type: provider,
        card: validCardDetails,
      });

      expect(created.id).toBeTruthy();
      expect(created.status).toBe('processing');
      expect(created.created_at).toBeTruthy();

      expect(active.id).toBe(created.id);
      expect(active.type).toBe(provider);
      expect(active.card.brand).toBe('visa');
      expect(active.card.holder_name).toBe(validCardDetails.holder_name);
      expect(active.card.last4).toBe(validCardDetails.number.slice(-4));
      expect(active.card.exp_month).toBe(validCardDetails.exp_month);
      expect(active.card.exp_year).toBe(validCardDetails.exp_year);

      const responseBody = JSON.stringify(active);
      expect(responseBody).not.toContain(validCardDetails.number);
      expect(responseBody).not.toContain(validCardDetails.cvc);
    });
  }

  test('creates a valid SEPA payment method', {
    tag: ['@regression', '@smoke', '@contract'],
  }, async ({ request }) => {
    const client = new PaymentApiClient(request);

    const { created, active } = await createActivePaymentMethod(client, {
      type: 'sepa',
      sepa: validSepaDetails,
    });

    expect(created.id).toBeTruthy();
    expect(created.status).toBe('processing');
    expect(created.created_at).toBeTruthy();

    expect(active.type).toBe('sepa');
    expect(active.sepa.holder_name).toBe(validSepaDetails.holder_name);
    expect(active.sepa.country).toBe('DE');
    expect(active.sepa.iban_last4).toBe(validSepaDetails.iban.slice(-4));

    const responseBody = JSON.stringify(active);
    expect(responseBody).not.toContain(validSepaDetails.iban);
  });
});

test.describe('payment method validation', () => {
  test('invalid card number', {
    tag: ['@regression', '@contract', '@negative'],
  }, async ({ request }) => {
    const client = new PaymentApiClient(request);

    const response = await client.createPaymentMethod({
      type: 'adyen',
      card: {
        ...validCardDetails,
        number: invalidLuhnCardNumber,
      },
    });

    await expectApiError(response, 422, 'invalid_card_number');
  });

  test('expired card', {
    tag: ['@regression', '@contract', '@negative'],
  }, async ({ request }) => {
    const client = new PaymentApiClient(request);

    const response = await client.createPaymentMethod({
      type: 'adyen',
      card: expiredCardPaymentMethod,
    });

    await expectApiError(response, 422, 'card_expired');
  });

  test('payment-method schema mismatch', {
    tag: ['@regression', '@contract', '@negative'],
  }, async ({ request }) => {
    const client = new PaymentApiClient(request);

    const response = await client.createPaymentMethod({
      type: 'sepa',
      card: validCardDetails,
    });

    await expectApiError(response, 422, 'schema_mismatch');
  });

  test('invalid CVC', {
    tag: ['@regression', '@contract', '@negative', '@boundary'],
  }, async ({ request }) => {
    const client = new PaymentApiClient(request);

    const response = await client.createPaymentMethod({
      type: 'adyen',
      card: {
        ...validCardDetails,
        cvc: invalidCvc,
      },
    });

    await expectApiError(response, 422, 'invalid_cvc');
  });

  test('invalid IBAN', {
    tag: ['@regression', '@contract', '@negative'],
  }, async ({ request }) => {
    const client = new PaymentApiClient(request);

    const response = await client.createPaymentMethod({
      type: 'sepa',
      sepa: {
        ...validSepaDetails,
        iban: invalidIban,
      },
    });

    await expectApiError(response, 422, 'invalid_iban');
  });

  test('exp_month below minimum', {
    tag: ['@regression', '@contract', '@negative', '@boundary'],
  }, async ({ request }) => {
    const client = new PaymentApiClient(request);

    const response = await client.createPaymentMethod({
      type: 'adyen',
      card: {
        ...validCardDetails,
        exp_month: 0,
      },
    });

    await expectApiError(response, 422, 'card_expired');
  });

  test('exp_month above maximum', {
    tag: ['@regression', '@contract', '@negative', '@boundary'],
  }, async ({ request }) => {
    const client = new PaymentApiClient(request);

    const response = await client.createPaymentMethod({
      type: 'adyen',
      card: {
        ...validCardDetails,
        exp_month: 13,
      },
    });

    await expectApiError(response, 422, 'card_expired');
  });

  test('invalid holder name', {
    tag: ['@regression', '@contract', '@negative'],
  }, async ({ request }) => {
    const client = new PaymentApiClient(request);

    const response = await client.createPaymentMethod({
      type: 'adyen',
      card: {
        ...validCardDetails,
        holder_name: invalidHolderName,
      },
    });

    await expectApiError(response, 422, 'invalid_holder_name');
  });

  test('invalid BIC', {
    tag: ['@regression', '@contract', '@negative', '@boundary'],
  }, async ({ request }) => {
    const client = new PaymentApiClient(request);

    const response = await client.createPaymentMethod({
      type: 'sepa',
      sepa: {
        ...validSepaDetails,
        bic: invalidBic,
      },
    });

    await expectApiError(response, 422, 'invalid_bic');
  });
});

test('creates a valid SEPA payment method with optional BIC', {
  tag: ['@regression', '@contract'],
}, async ({ request }) => {
  const client = new PaymentApiClient(request);

  const { active } = await createActivePaymentMethod(client, {
    type: 'sepa',
    sepa: {
      ...validSepaDetails,
      bic: validBic,
    },
  });

  expect(active.type).toBe('sepa');
  expect(active.status).toBe('active');
  expect(active.sepa.holder_name).toBe(validSepaDetails.holder_name);
  expect(active.sepa.country).toBe('DE');
  expect(active.sepa.iban_last4).toBe(validSepaDetails.iban.slice(-4));
});
