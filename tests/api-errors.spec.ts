import { expect, test } from '@playwright/test';
import { PaymentApiClient } from '../src/client/payment-api.client';
import {
  invalidApiKey,
  nonexistentPaymentId,
  nonexistentPaymentMethodLookupId,
} from '../src/data/test-data';

const baseURL =
  process.env.BASE_URL ?? 'https://qa-interview-service.fly.dev';

test('missing API key', async ({ playwright }) => {
  const context = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  });

  try {
    const response = await context.get(`/payments/${nonexistentPaymentId}`);

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBeTruthy();
    expect(body.error.code).toBe('invalid_api_key');
    expect(body.error.message).toBeTruthy();
    expect(body.error.message.length).toBeGreaterThan(0);
  } finally {
    await context.dispose();
  }
});

test('invalid API key', async ({ playwright }) => {
  const context = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
      'X-Api-Key': invalidApiKey,
    },
  });

  try {
    const response = await context.get(`/payments/${nonexistentPaymentId}`);

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBeTruthy();
    expect(body.error.code).toBe('invalid_api_key');
    expect(body.error.message).toBeTruthy();
    expect(body.error.message.length).toBeGreaterThan(0);
  } finally {
    await context.dispose();
  }
});

test('unknown payment method', async ({ request }) => {
  const client = new PaymentApiClient(request);

  const response = await client.getPaymentMethod(
    nonexistentPaymentMethodLookupId,
  );

  expect(response.status()).toBe(404);
  const body = await response.json();
  expect(body.error).toBeTruthy();
  expect(body.error.code).toBe('not_found');
  expect(body.error.message).toBeTruthy();
  expect(body.error.message.length).toBeGreaterThan(0);
});

test('unknown payment', async ({ request }) => {
  const client = new PaymentApiClient(request);

  const response = await client.getPayment(nonexistentPaymentId);

  expect(response.status()).toBe(404);
  const body = await response.json();
  expect(body.error).toBeTruthy();
  expect(body.error.code).toBe('not_found');
  expect(body.error.message).toBeTruthy();
  expect(body.error.message.length).toBeGreaterThan(0);
});
