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
API_KEY=your-key-here
```

## Run tests

```bash
npm test
```

## Why polling?

Creating payment methods and payments is asynchronous. `POST` responses return a minimal `processing` object. Tests poll `GET` endpoints until the resource reaches a terminal state (`active` for payment methods, `succeeded` or `failed` for payments).

## Project structure

```
src/
  client/     # Thin API client around Playwright APIRequestContext
  helpers/    # Reusable polling helper
  data/       # Deterministic test payloads
tests/        # Test scenarios and assertions
```
