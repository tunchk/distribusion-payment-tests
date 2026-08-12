import { expect, test } from '@playwright/test';
import { PaymentApiClient } from '../src/client/payment-api.client';
import {
  cardPaymentMethod,
  expiredCardPaymentMethod,
  invalidLuhnCardNumber,
  sepaPaymentMethod,
} from '../src/data/test-data';
import { poll } from '../src/helpers/poll';

test.describe('payment methods', () => {
  for (const provider of ['adyen', 'checkout'] as const) {
    test(`creates a valid ${provider} card payment method`, {
      tag: ['@regression', '@smoke', '@contract'],
    }, async ({ request }) => {
      const client = new PaymentApiClient(request);

      const createResponse = await client.createPaymentMethod({
        type: provider,
        card: cardPaymentMethod,
      });

      expect(createResponse.status()).toBe(201);
      const created = await createResponse.json();
      expect(created.id).toBeTruthy();
      expect(created.status).toBe('processing');
      expect(created.created_at).toBeTruthy();

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

      expect(active.id).toBe(created.id);
      expect(active.type).toBe(provider);
      expect(active.card.holder_name).toBe(cardPaymentMethod.holder_name);
      expect(active.card.last4).toBe(cardPaymentMethod.number.slice(-4));
      expect(active.card.exp_month).toBe(cardPaymentMethod.exp_month);
      expect(active.card.exp_year).toBe(cardPaymentMethod.exp_year);

      const responseBody = JSON.stringify(active);
      expect(responseBody).not.toContain(cardPaymentMethod.number);
      expect(responseBody).not.toContain(cardPaymentMethod.cvc);
    });
  }

  test('creates a valid SEPA payment method', {
    tag: ['@regression', '@smoke', '@contract'],
  }, async ({ request }) => {
    const client = new PaymentApiClient(request);

    const createResponse = await client.createPaymentMethod({
      type: 'sepa',
      sepa: sepaPaymentMethod,
    });

    expect(createResponse.status()).toBe(201);
    const created = await createResponse.json();
    expect(created.id).toBeTruthy();
    expect(created.status).toBe('processing');
    expect(created.created_at).toBeTruthy();

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

    expect(active.type).toBe('sepa');
    expect(active.sepa.holder_name).toBe(sepaPaymentMethod.holder_name);
    expect(active.sepa.iban_last4).toBe(sepaPaymentMethod.iban.slice(-4));

    const responseBody = JSON.stringify(active);
    expect(responseBody).not.toContain(sepaPaymentMethod.iban);
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
        ...cardPaymentMethod,
        number: invalidLuhnCardNumber,
      },
    });

    expect(response.status()).toBe(422);
    const body = await response.json();
    expect(body.error).toBeTruthy();
    expect(body.error.code).toBe('invalid_card_number');
    expect(body.error.message).toBeTruthy();
    expect(body.error.message.length).toBeGreaterThan(0);
  });

  test('expired card', {
    tag: ['@regression', '@contract', '@negative'],
  }, async ({ request }) => {
    const client = new PaymentApiClient(request);

    const response = await client.createPaymentMethod({
      type: 'adyen',
      card: expiredCardPaymentMethod,
    });

    expect(response.status()).toBe(422);
    const body = await response.json();
    expect(body.error).toBeTruthy();
    expect(body.error.code).toBe('card_expired');
    expect(body.error.message).toBeTruthy();
    expect(body.error.message.length).toBeGreaterThan(0);
  });

  test('payment-method schema mismatch', {
    tag: ['@regression', '@contract', '@negative'],
  }, async ({ request }) => {
    const client = new PaymentApiClient(request);

    const response = await client.createPaymentMethod({
      type: 'sepa',
      card: cardPaymentMethod,
    });

    expect(response.status()).toBe(422);
    const body = await response.json();
    expect(body.error).toBeTruthy();
    expect(body.error.code).toBe('schema_mismatch');
    expect(body.error.message).toBeTruthy();
    expect(body.error.message.length).toBeGreaterThan(0);
  });
});
