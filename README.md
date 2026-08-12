# Distribution Payment API Tests

TypeScript + Playwright API automation suite for the [Distribusion Payment Simulation API](https://qa-interview-service.fly.dev/docs).

The published OpenAPI/documentation is treated as the contract. Tests assert documented status codes, fields, async transitions, and error codes rather than adapting to undocumented runtime behavior.

## Test approach

Coverage is risk-based, not driven by test count. The suite focuses on the highest-value contract and payment risks:

- core payment flows
- asynchronous state transitions
- documented decline scenarios
- validation and error contracts
- authentication behavior
- not-found behavior
- sensitive payment data exposure
- cross-endpoint consistency
- protocol-level errors

## Prerequisites

- Node.js 18+
- A personal API key for the challenge service

## Setup

```bash
npm install
cp .env.example .env
```

Add values to `.env`:

```
BASE_URL=https://qa-interview-service.fly.dev
API_KEY=your-key-here
API_LOGGING=false
```

`.env` is gitignored. Credentials must never be committed.

## Running tests

Full suite:

```bash
npm test
```

Deterministic debug run:

```bash
API_LOGGING=true npx playwright test --workers=1
```

Single-worker mode keeps request/response logs sequential, which makes it easier to follow one flow at a time.

## Running tagged suites

Tags currently used:

- `@regression` — main release-confidence suite. All current tests belong to regression. Contract failures are intentionally included.
- `@smoke` — critical payment method and payment flows
- `@contract` — documented API behavior and cross-endpoint consistency
- `@negative` — expected rejection, validation, decline, and error scenarios
- `@authentication` — missing and invalid API key scenarios

```bash
npx playwright test --grep @regression
npx playwright test --grep @smoke
npx playwright test --grep @contract
npx playwright test --grep @negative
npx playwright test --grep @authentication
```

The smoke and regression suites are currently expected to fail because the successful-payment contract test exposes a known API contract violation. That is an API mismatch, not a broken tag setup.

## Debug logging

Logging is disabled by default. When `API_LOGGING=true`, the suite logs HTTP method/path, request body, response status, and response body.

The API key is never logged. Full card number, CVC, and IBAN are redacted.

## HTML report

Playwright's built-in HTML reporter writes to `playwright-report/`.

```bash
npx playwright show-report
```

## Why polling?

Creating a payment method or payment is asynchronous. `POST` responses return a minimal `processing` object. Payment methods become `active`; payments become `succeeded` or `failed`.

Tests poll `GET` until the terminal condition is reached. Polling has configurable timeout and interval. Fixed sleeps are not used.

## Current coverage

### Payment methods

- Valid Adyen card payment method
- Valid Checkout card payment method
- Valid SEPA payment method
- Sensitive payment data exposure checks
- Invalid card number validation
- Expired card validation
- Payment-method schema mismatch validation

### Payments

- Successful payment flow
- Card decline flow
- SEPA debit decline flow
- Invalid payment amount validation
- Unsupported currency validation
- Unknown payment method validation
- Payment listing
- Oldest-first ordering
- Cross-endpoint payment identity consistency

### API errors / protocol

- Missing API key
- Invalid API key
- Payment method not found
- Payment not found
- Invalid JSON
- Unsupported media type

## Known contract violations

These two failures are stable and treated as contract violations, not flaky tests. Assertions are left failing on purpose. There are no workarounds or expected-failure annotations.

### 1. Payment holder-name inconsistency

Observed:

- The payment method becomes `active` with `holder_name` `"Jane Doe"`.
- `GET /payments/{id}` returns `holder_name` `"Jane Do"`.

The contract says `Payment.holder_name` is the holder name of the payment method used for that payment. The successful-payment assertion keeps expecting `"Jane Doe"`.

### 2. Payment-list resource identity inconsistency

Observed:

- `POST /payments` creates payment IDs.
- `GET /payments/{id}` preserves those IDs.
- `GET /payment-methods/{id}/payments` returns entries with matching `payment_method_id`, `amount`, `currency`, `status`, and `created_at`.
- The listed payment IDs are different.
- Oldest-first ordering by `created_at` appears correct.

Payment identity should be consistent across endpoints. The list test still asserts that listed IDs match the created payment IDs.

## Design decisions

- Thin API client around Playwright `APIRequestContext`.
- The client returns raw `APIResponse` objects so tests can assert both success and error responses.
- Assertions stay in spec files.
- Test data is deterministic.
- Reusable polling is used instead of fixed sleeps.
- Credentials come from environment variables.
- Optional logging redacts sensitive payment data.
- Malformed and protocol-specific requests stay in `api-errors.spec.ts` so the main client stays JSON-oriented.
- No extra third-party reporting, schema, or DI libraries.

## Out of scope

Intentionally excluded to keep the exercise focused and avoid unnecessary load on the shared remote service:

- load/stress testing
- deliberate rate-limit exhaustion
- 413 payload-too-large testing
- CI/CD setup
- full OpenAPI/JSON Schema validator integration

## Project structure

```
src/
  client/
    payment-api.client.ts
  helpers/
    poll.ts
    logger.ts
  data/
    test-data.ts
tests/
  payment-methods.spec.ts
  payments.spec.ts
  api-errors.spec.ts
```
