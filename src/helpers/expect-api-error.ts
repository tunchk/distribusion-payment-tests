import { APIResponse, expect } from '@playwright/test';

export async function expectApiError(
  response: APIResponse,
  expectedStatus: number,
  expectedCode: string,
) {
  expect(response.status()).toBe(expectedStatus);
  const body = await response.json();
  expect(body.error).toBeTruthy();
  expect(body.error.code).toBe(expectedCode);
  expect(typeof body.error.message).toBe('string');
  expect(body.error.message.length).toBeGreaterThan(0);
  return body;
}
