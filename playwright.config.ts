import dotenv from 'dotenv';
import { defineConfig } from '@playwright/test';

dotenv.config();

const baseURL = process.env.BASE_URL ?? 'https://qa-interview-service.fly.dev';
const apiKey = process.env.API_KEY;

if (!apiKey) {
  throw new Error(
    'API_KEY is missing. Copy .env.example to .env and set your API key.',
  );
}

export default defineConfig({
  testDir: './tests',
  // Comfortably above the 30s poll timeout used by async lifecycle helpers.
  timeout: 60_000,
  // Shared remote API (300 req/min). One worker keeps traffic predictable and logs sequential.
  fullyParallel: false,
  workers: 1,
  // Local contract failures must stay visible. One CI retry only for transient network issues.
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: 'playwright-report',
        open: 'never',
      },
    ],
  ],
  use: {
    baseURL,
    extraHTTPHeaders: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
  },
});
