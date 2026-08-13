# Distribusion Payment API Tests

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

The suite defaults to 2 workers. The API is remote and rate-limited to 300 requests/minute, and async payment-method/payment flows poll resource state, so parallelism and polling are tuned together. Concurrency is bounded rather than unrestricted.

Deterministic debug run:

```bash
API_LOGGING=true npx playwright test --workers=1
```

`--workers=1` is useful for sequential request/response logs during debugging, even though the normal default is 2 workers.

### Execution policy

- Two workers by default. Parallelism is intentionally bounded because the remote API is rate-limited and asynchronous flows poll resource state.
- Measured in this challenge environment: 1 worker + 500 ms polling ran in ~47–49s; 2 workers + 500 ms polling ran in ~41–42s. Three consecutive full-suite runs with 2 workers + 500 ms showed no 429 responses, polling timeouts, or additional flaky failures. This is a pragmatic setting for this shared challenge API, not a universal production default.
- Local retries are disabled so contract failures remain immediately visible.
- CI uses at most one retry for isolated transient/network issues.
- Polling times out after 25 seconds. The Playwright test timeout is 40 seconds, intentionally higher so polling can fail first with its own diagnostic message and last observed value. The extra headroom covers request setup, response parsing, logging, and assertions.

## Running tagged suites

Tags currently used:

- `@regression` — main release-confidence suite. All current tests belong to regression. Contract failures are intentionally included.
- `@smoke` — critical payment method and payment flows
- `@contract` — documented API behavior and cross-endpoint consistency
- `@negative` — expected rejection, validation, decline, and error scenarios
- `@authentication` — missing and invalid API key scenarios
- `@e2e` — multi-step payment lifecycle/business flows
- `@boundary` — boundary-value and type-boundary validation scenarios

```bash
npx playwright test --grep @regression
npx playwright test --grep @smoke
npx playwright test --grep @contract
npx playwright test --grep @negative
npx playwright test --grep @authentication
npx playwright test --grep @e2e
npx playwright test --grep @boundary
```

The smoke and regression suites are currently expected to fail because the successful-payment contract test exposes a known API contract violation. This reflects a known API contract mismatch rather than an issue with the tag configuration.

## Continuous integration

GitHub Actions runs on pushes and pull requests.

CI performs:

- dependency installation with `npm ci`
- TypeScript type checking
- the `@regression` Playwright suite

API credentials come from the repository's `API_KEY` GitHub Actions secret. The base URL is configured in the workflow. CI uses one retry through the existing Playwright config for isolated transient/network failures.

Known contract violations are intentionally not excluded, so the workflow remains red while those API mismatches exist.

Repository setup:

Settings → Secrets and variables → Actions → New repository secret

Secret name:

`API_KEY`

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

Tests poll `GET` until the terminal condition is reached. The default poll interval is 500 ms. Polling and bounded parallel execution can coexist; the combined request rate is why concurrency stays limited. Fixed sleeps are avoided. Separate timeout layers keep polling diagnostics visible: a poll timeout fails with last observed state before Playwright's overall test timeout.

## Current coverage

### Payment methods

- Valid Adyen card payment method
- Valid Checkout card payment method
- Valid SEPA payment method
- Valid SEPA payment method with optional BIC
- Sensitive payment data exposure checks
- Invalid card number validation
- Expired card validation
- Payment-method schema mismatch validation
- Invalid CVC validation
- Invalid IBAN validation
- Invalid BIC validation
- Invalid holder-name validation
- `exp_month` lower/upper invalid boundaries (`0`, `13`)

### Payments

- Successful Adyen payment flow
- Successful Checkout payment flow
- Successful SEPA payment flow
- Card decline flow
- SEPA debit decline flow
- Minimum valid amount (`1`)
- Invalid amount (`0`, negative, wrong type)
- Supported currencies: EUR, USD, GBP
- Unsupported currency validation
- Unknown payment method validation
- Payment listing
- Empty payment list
- Oldest-first ordering
- Cross-endpoint payment identity consistency

### API errors / protocol

- Missing API key
- Invalid API key
- Payment method not found
- Payment not found
- Payment list for unknown payment method
- Invalid JSON
- Unsupported media type

## Known contract violations

These two failures are stable and treated as contract violations. Assertions are left failing on purpose. There are no workarounds or expected-failure annotations.

### 1. Payment holder-name inconsistency

Observed:

- The end-to-end payment flow itself completes successfully.
- The payment reaches status `"succeeded"`.
- The test fails only because the payment method returns `holder_name` `"Jane Doe"` while `GET /payments/{id}` returns `"Jane Do"`.

The assertion intentionally remains strict because the API contract says the payment holder name should reflect the holder name of the payment method used.

### 2. Payment-list resource identity inconsistency

Observed:

- The created payments are successfully retrievable through `GET /payments/{id}`.
- `GET /payment-methods/{id}/payments` returns corresponding records with matching `payment_method_id`, `amount`, `currency`, `status`, and `created_at`.
- However, the payment IDs returned by the list endpoint differ from the IDs created by `POST /payments`.
- Oldest-first ordering itself appears correct.

The assertions intentionally remain strict because resource identity is expected to remain consistent across endpoints.

These failures are intentionally kept visible in the regression and contract suites, and in smoke or e2e suites where applicable, rather than being masked or converted into expected failures.

## Design decisions

- Thin API client around Playwright `APIRequestContext`.
- The client returns raw `APIResponse` objects so tests can assert both success and error responses.
- Assertions stay in spec files.
- Lightweight reusable contract assertions validate documented response shapes, required fields, enums, conditional fields, date-times, and sensitive-data exclusion without introducing a full OpenAPI runtime validator.
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
- racing asynchronous list items while they are still `processing`
- full OpenAPI/JSON Schema validator integration

### Intentionally not exercised

These contracts were considered and left out of this suite on purpose. They remain testable in a controlled environment.

#### 1. Rate-limit exhaustion (429)

The API allows 300 requests/minute per API key. Exceeding that returns `429` with a `Retry-After` header. We do not exhaust the limit against the shared challenge service because the brief asks us not to stress it.

In a controlled environment: send requests at a known rate until the threshold is exceeded; assert the first throttled response is `429`; assert `Retry-After` is present and valid; confirm requests stay throttled during that window; then confirm normal requests recover after it expires. No skipped 429 test is added here.

#### 2. Payload-too-large (413)

`413` is a documented error contract. We do not send oversized bodies to the shared remote service: it is low-value for core payment-flow coverage and creates unnecessary traffic.

In a controlled environment this is boundary-value testing: obtain the configured maximum body size; send a payload just below the limit (and the exact boundary if inclusive/exclusive behavior is defined); send a payload just above the limit; assert `413` and the documented error envelope/code.

#### 3. Processing resources in payment lists

`GET /payment-methods/{id}/payments` may return `ProcessingResource` or terminal `Payment` items. Current list tests wait until created payments are terminal before validating list items. We do not race the async transition here because that would be timing-dependent and potentially flaky. This environment does not give deterministic control over processing latency.

In a deterministic environment: create a payment whose processing duration can be delayed; call the list endpoint before it becomes terminal; locate the created item and validate it as a `ProcessingResource` (`id`, `status = processing`, `created_at`); wait until it is terminal; list again and verify the same logical payment is represented as a terminal `Payment`.

## Project structure

```
.github/
  workflows/
    api-tests.yml
src/
  client/
    payment-api.client.ts
  helpers/
    expect-api-error.ts
    expect-contract.ts
    logger.ts
    payment-lifecycle.ts
    poll.ts
  data/
    test-data.ts
tests/
  payment-methods.spec.ts
  payments.spec.ts
  api-errors.spec.ts
```
