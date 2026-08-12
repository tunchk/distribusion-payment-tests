import { expect, test } from '@playwright/test';
import { PaymentApiClient } from '../src/client/payment-api.client';
import {
  invalidApiKey,
  nonexistentPaymentId,
  nonexistentPaymentMethodLookupId,
} from '../src/data/test-data';
import { expectApiError } from '../src/helpers/expect-api-error';

const baseURL =
  process.env.BASE_URL ?? 'https://qa-interview-service.fly.dev';

test('missing API key', {
  tag: ['@regression', '@contract', '@negative', '@authentication'],
}, async ({ playwright }) => {
  const context = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  });

  try {
    const response = await context.get(`/payments/${nonexistentPaymentId}`);
    await expectApiError(response, 401, 'invalid_api_key');
  } finally {
    await context.dispose();
  }
});

test('invalid API key', {
  tag: ['@regression', '@contract', '@negative', '@authentication'],
}, async ({ playwright }) => {
  const context = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
      'X-Api-Key': invalidApiKey,
    },
  });

  try {
    const response = await context.get(`/payments/${nonexistentPaymentId}`);
    await expectApiError(response, 401, 'invalid_api_key');
  } finally {
    await context.dispose();
  }
});

test('unknown payment method', {
  tag: ['@regression', '@contract', '@negative'],
}, async ({ request }) => {
  const client = new PaymentApiClient(request);

  const response = await client.getPaymentMethod(
    nonexistentPaymentMethodLookupId,
  );

  await expectApiError(response, 404, 'not_found');
});

test('unknown payment', {
  tag: ['@regression', '@contract', '@negative'],
}, async ({ request }) => {
  const client = new PaymentApiClient(request);

  const response = await client.getPayment(nonexistentPaymentId);

  await expectApiError(response, 404, 'not_found');
});

test('payment list for unknown payment method', {
  tag: ['@regression', '@contract', '@negative'],
}, async ({ request }) => {
  const client = new PaymentApiClient(request);

  const response = await client.listPaymentsByPaymentMethod(
    nonexistentPaymentMethodLookupId,
  );

  await expectApiError(response, 404, 'not_found');
});

test('invalid JSON', {
  tag: ['@regression', '@contract', '@negative'],
}, async ({ request }, testInfo) => {
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

test('unsupported media type', {
  tag: ['@regression', '@contract', '@negative'],
}, async ({ request }) => {
  const response = await request.post('/payments', {
    headers: {
      'Content-Type': 'text/plain',
    },
    data: 'not json',
  });

  await expectApiError(response, 415, 'unsupported_media_type');
});
