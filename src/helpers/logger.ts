const apiLoggingEnabled = process.env.API_LOGGING === 'true';

function redactByPath(value: unknown, path: string[] = []): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redactByPath(v, path));

  const obj = value as Record<string, unknown>;
  const next = { ...obj };

  for (const [key, v] of Object.entries(obj)) {
    const nextPath = [...path, key];

    // card.number / card.cvc
    if (
      nextPath.length >= 2 &&
      nextPath[nextPath.length - 2] === 'card' &&
      (nextPath[nextPath.length - 1] === 'number' ||
        nextPath[nextPath.length - 1] === 'cvc')
    ) {
      next[key] = '[REDACTED]';
      continue;
    }

    // sepa.iban
    if (
      nextPath.length >= 2 &&
      nextPath[nextPath.length - 2] === 'sepa' &&
      nextPath[nextPath.length - 1] === 'iban'
    ) {
      next[key] = '[REDACTED]';
      continue;
    }

    next[key] = redactByPath(v, nextPath);
  }

  return next;
}

export function isApiLoggingEnabled(): boolean {
  return apiLoggingEnabled;
}

export async function logApiRequestAndResponse(args: {
  method: string;
  path: string;
  requestBody?: unknown;
  response: { status: () => number; json: () => Promise<unknown> };
}) {
  if (!apiLoggingEnabled) return;

  const { method, path, requestBody, response } = args;

  // Logging should never mutate user-provided objects.
  const redactedRequest =
    requestBody !== undefined ? redactByPath(requestBody) : undefined;
  const responseStatus = response.status();

  let parsedResponse: unknown = undefined;
  try {
    parsedResponse = await response.json();
  } catch {
    // If JSON parsing fails, omit body to avoid double-reading issues.
  }

  // Avoid printing any auth headers or API keys; we only log method/path/body.
  // Keep it interview-friendly: method/path, then request, then status/body.
  // eslint-disable-next-line no-console
  console.log(
    `${method} ${path}${requestBody !== undefined ? '\nRequest:' : ''}`,
  );

  if (redactedRequest !== undefined) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(redactedRequest, null, 2));
  }

  // eslint-disable-next-line no-console
  console.log(`Response: ${responseStatus}`);

  if (parsedResponse !== undefined) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(redactByPath(parsedResponse), null, 2));
  }
}

