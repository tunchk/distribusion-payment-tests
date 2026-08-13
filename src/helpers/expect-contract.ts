import { expect } from '@playwright/test';

const PAYMENT_METHOD_TYPES = ['adyen', 'checkout', 'sepa'] as const;
const CARD_BRANDS = ['visa', 'mastercard', 'amex', 'other'] as const;
const PAYMENT_STATUSES = ['succeeded', 'failed'] as const;
const PAYMENT_CURRENCIES = ['EUR', 'USD', 'GBP'] as const;
const FAILURE_REASONS = ['card_declined', 'debit_declined'] as const;

const FORBIDDEN_SENSITIVE_KEYS = ['number', 'cvc', 'iban'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  expect(isRecord(value), `${label} must be an object`).toBe(true);
  return value as Record<string, unknown>;
}

function assertNonEmptyString(value: unknown, fieldName: string): asserts value is string {
  expect(typeof value, `${fieldName} must be a string`).toBe('string');
  expect((value as string).length, `${fieldName} must be non-empty`).toBeGreaterThan(0);
}

function assertNoForbiddenSensitiveKeys(
  obj: Record<string, unknown>,
  context: string,
): void {
  for (const key of FORBIDDEN_SENSITIVE_KEYS) {
    expect(obj, `${context} must not expose "${key}"`).not.toHaveProperty(key);
  }
}

export function expectIsoDateTime(value: unknown): void {
  assertNonEmptyString(value, 'date-time');
  expect(Number.isNaN(Date.parse(value)), 'date-time must be parseable').toBe(false);
}

export function expectProcessingResource(value: unknown): void {
  const resource = expectRecord(value, 'ProcessingResource');

  assertNonEmptyString(resource.id, 'id');
  expect(resource.status, 'status must be "processing"').toBe('processing');
  expectIsoDateTime(resource.created_at);
}

export function expectActivePaymentMethod(
  value: unknown,
  options: {
    type: 'adyen' | 'checkout' | 'sepa';
    sensitiveInputs?: {
      cardNumber?: string;
      cvc?: string;
      iban?: string;
    };
  },
): void {
  const paymentMethod = expectRecord(value, 'PaymentMethod');

  assertNonEmptyString(paymentMethod.id, 'id');
  expect(PAYMENT_METHOD_TYPES, 'type must be adyen, checkout, or sepa').toContain(
    paymentMethod.type,
  );
  expect(paymentMethod.type, 'type must match expected provider').toBe(options.type);
  expect(paymentMethod.status, 'status must be "active"').toBe('active');
  expectIsoDateTime(paymentMethod.created_at);

  assertNoForbiddenSensitiveKeys(paymentMethod, 'PaymentMethod');

  if (options.type === 'adyen' || options.type === 'checkout') {
    expect(paymentMethod.sepa, 'card payment methods must not include sepa').toBeUndefined();
    const card = expectRecord(paymentMethod.card, 'PaymentMethod.card');

    assertNoForbiddenSensitiveKeys(card, 'PaymentMethod.card');
    expect(CARD_BRANDS, 'brand must be a documented card brand').toContain(card.brand);
    expect(typeof card.last4, 'last4 must be a string').toBe('string');
    expect(Number.isInteger(card.exp_month), 'exp_month must be an integer').toBe(true);
    expect(Number.isInteger(card.exp_year), 'exp_year must be an integer').toBe(true);
    expect(typeof card.holder_name, 'holder_name must be a string').toBe('string');
  } else {
    expect(paymentMethod.card, 'sepa payment methods must not include card').toBeUndefined();
    const sepa = expectRecord(paymentMethod.sepa, 'PaymentMethod.sepa');

    assertNoForbiddenSensitiveKeys(sepa, 'PaymentMethod.sepa');
    expect(typeof sepa.holder_name, 'holder_name must be a string').toBe('string');
    expect(typeof sepa.country, 'country must be a string').toBe('string');
    expect(typeof sepa.iban_last4, 'iban_last4 must be a string').toBe('string');
  }

  if (options.sensitiveInputs) {
    expectResponseExcludesSensitiveData(
      JSON.stringify(paymentMethod),
      options.sensitiveInputs,
    );
  }
}

export function expectPayment(
  value: unknown,
  options?: {
    status?: 'succeeded' | 'failed';
    failureReason?: 'card_declined' | 'debit_declined';
  },
): void {
  const payment = expectRecord(value, 'Payment');

  assertNonEmptyString(payment.id, 'id');
  assertNonEmptyString(payment.payment_method_id, 'payment_method_id');
  expect(typeof payment.holder_name, 'holder_name must be a string').toBe('string');
  expect(Number.isInteger(payment.amount), 'amount must be an integer').toBe(true);
  expect(PAYMENT_CURRENCIES, 'currency must be EUR, USD, or GBP').toContain(
    payment.currency,
  );
  expect(PAYMENT_STATUSES, 'status must be succeeded or failed').toContain(
    payment.status,
  );
  expectIsoDateTime(payment.created_at);

  const status = payment.status as 'succeeded' | 'failed';

  if (options?.status !== undefined) {
    expect(status, 'status must match expected terminal status').toBe(options.status);
  }

  if (status === 'succeeded') {
    expect(
      payment.failure_reason,
      'failure_reason must be absent when status is succeeded',
    ).toBeUndefined();
  } else {
    expect(FAILURE_REASONS, 'failure_reason must be a documented decline code').toContain(
      payment.failure_reason,
    );
  }

  if (options?.failureReason !== undefined) {
    expect(payment.failure_reason, 'failure_reason must match expected code').toBe(
      options.failureReason,
    );
  }
}

export function expectPaymentListWrapper(value: unknown): unknown[] {
  const body = expectRecord(value, 'list response');
  expect(body, 'list response must include data').toHaveProperty('data');
  expect(Array.isArray(body.data), 'data must be an array').toBe(true);

  return body.data as unknown[];
}

export function expectResponseExcludesSensitiveData(
  serializedResponse: string,
  sensitive: {
    cardNumber?: string;
    cvc?: string;
    iban?: string;
  },
): void {
  if (sensitive.cardNumber) {
    expect(serializedResponse, 'response must not contain full card number').not.toContain(
      sensitive.cardNumber,
    );
  }

  if (sensitive.cvc) {
    expect(serializedResponse, 'response must not contain CVC').not.toContain(
      sensitive.cvc,
    );
  }

  if (sensitive.iban) {
    expect(serializedResponse, 'response must not contain full IBAN').not.toContain(
      sensitive.iban,
    );
  }
}
