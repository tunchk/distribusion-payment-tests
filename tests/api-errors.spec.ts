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

test('invalid JSON', async ({ request }, testInfo) => {
  const malformedJson = '{"payment_method_id":';

  const response = await request.post('/payments', {
    headers: {
      'Content-Type': 'application/json',
    },
    // Buffer is sent as raw bytes. A JS string in `data` can be JSON-serialized.
    data: Buffer.from(malformedJson, 'utf8'),
  });

  const status = response.status();
  const rawResponseBody = await response.text();

  const debugPayload = {
    rawMalformedBodySent: malformedJson,
    responseHttpStatus: status,
    rawResponseBody,
  };

  await testInfo.attach('invalid-json-debug', {
    body: JSON.stringify(debugPayload, null, 2),
    contentType: 'application/json',
  });

  expect(status).toBe(400);
  const body = JSON.parse(rawResponseBody);
  expect(body.error).toBeTruthy();
  expect(body.error.code).toBe('invalid_json');
  expect(body.error.message).toBeTruthy();
  expect(body.error.message.length).toBeGreaterThan(0);
});

test('unsupported media type', async ({ request }) => {
  const response = await request.post('/payments', {
    headers: {
      'Content-Type': 'text/plain',
    },
    data: 'not json',
  });

  expect(response.status()).toBe(415);
  const body = await response.json();
  expect(body.error).toBeTruthy();
  expect(body.error.code).toBe('unsupported_media_type');
  expect(body.error.message).toBeTruthy();
  expect(body.error.message.length).toBeGreaterThan(0);
});
