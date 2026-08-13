export interface PollOptions {
  timeout?: number;
  interval?: number;
  description?: string;
}

function formatLastObservedValue(value: unknown): string {
  if (value === undefined) {
    return 'No value was observed before timeout.';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export async function poll<T>(
  fn: () => Promise<T>,
  isDone: (result: T) => boolean,
  options: PollOptions = {},
): Promise<T> {
  const timeout = options.timeout ?? 25_000;
  const interval = options.interval ?? 500;
  const start = Date.now();
  let lastResult: T | undefined;

  while (Date.now() - start < timeout) {
    lastResult = await fn();
    if (isDone(lastResult)) {
      return lastResult;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  const waitingFor = options.description
    ? ` while waiting for ${options.description}`
    : '';

  throw new Error(
    `Polling timed out after ${timeout}ms${waitingFor}.\nLast observed value:\n${formatLastObservedValue(lastResult)}`,
  );
}
