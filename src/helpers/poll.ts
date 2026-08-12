export interface PollOptions {
  timeout?: number;
  interval?: number;
  description?: string;
}

export async function poll<T>(
  fn: () => Promise<T>,
  isDone: (result: T) => boolean,
  options: PollOptions = {},
): Promise<T> {
  const timeout = options.timeout ?? 30_000;
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

  const detail = options.description ? ` (${options.description})` : '';
  const lastState =
    lastResult !== undefined ? ` Last value: ${JSON.stringify(lastResult)}` : '';

  throw new Error(`Polling timed out after ${timeout}ms${detail}.${lastState}`);
}
