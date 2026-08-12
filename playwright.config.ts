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
  timeout: 60_000,
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
