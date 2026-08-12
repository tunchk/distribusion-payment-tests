# Distribution Payment API Tests

Minimal Playwright API test suite for the [Distribusion Payment Simulation API](https://qa-interview-service.fly.dev/docs).

## Prerequisites

- Node.js 18+
- A personal API key for the challenge service

## Setup

```bash
npm install
cp .env.example .env
```

Add your API key to `.env`:

```
BASE_URL=https://qa-interview-service.fly.dev
API_KEY=your-key-here
API_LOGGING=false
```

## Run tests

```bash
npm test
```

To enable request/response debug logging:

```bash
API_LOGGING=true npm test
```

Logging is disabled by default, and the API key, full card number, CVC, and IBAN are never logged.

## Open the latest HTML report

```bash
npx playwright show-report
```

## Why polling?

Creating payment methods and payments is asynchronous. `POST` responses return a minimal `processing` object. Tests poll `GET` endpoints until the resource reaches a terminal state (`active` for payment methods, `succeeded` or `failed` for payments).

## Current coverage

- Valid Adyen card payment method
- Valid Checkout card payment method
- Valid SEPA payment method
- Sensitive payment data exposure checks
- Successful payment flow

## Project structure

```
src/
  client/     # Thin API client around Playwright APIRequestContext
  helpers/    # Reusable polling helper
  data/       # Deterministic test payloads
tests/        # Test scenarios and assertions
```
