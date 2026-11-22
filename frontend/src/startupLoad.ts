// Reads the client needs once per visit (the skill and class catalog, themes, sign-in providers, the profile).
// A hosted server can still be waking when the page loads (Render spins idle services down), so these reads keep
// retrying until the server answers instead of giving up after one failure and leaving the screen without its data.

/** Waits between attempts: quick at first, then every 15s while the server is still down. */
export const STARTUP_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];

/** Shown while a startup read is retrying; cleared again once it succeeds. */
export const WAKING_MESSAGE = "Waking the server… this can take a minute after a quiet spell.";

export type RetryOptions = {
  signal: AbortSignal;
  delays?: readonly number[];
  /** Called after each failed attempt, before waiting. `attempt` counts from 1. */
  onRetry?: (attempt: number, error: unknown) => void;
  /** How to wait between attempts; tests pass an instant one. */
  wait?: (ms: number, signal: AbortSignal) => Promise<void>;
};

function abortError(): Error {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

/** Waits `ms`, or less if the browser comes back online or the tab regains focus, which often means the server is up. */
export function defaultWait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(abortError()); return; }
    const done = () => { cleanup(); resolve(); };
    const stop = () => { cleanup(); reject(abortError()); };
    const timer = setTimeout(done, ms);
    const hasWindow = typeof window !== "undefined";
    function cleanup() {
      clearTimeout(timer);
      signal.removeEventListener("abort", stop);
      if (hasWindow) { window.removeEventListener("online", done); window.removeEventListener("focus", done); }
    }
    signal.addEventListener("abort", stop);
    if (hasWindow) { window.addEventListener("online", done); window.addEventListener("focus", done); }
  });
}

/** Runs `load` until it succeeds or `signal` aborts (then rejects with an AbortError). */
export async function loadUntilReady<T>(load: () => Promise<T>, { signal, delays = STARTUP_RETRY_DELAYS_MS, onRetry, wait = defaultWait }: RetryOptions): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    if (signal.aborted) throw abortError();
    try {
      return await load();
    } catch (error) {
      if (signal.aborted) throw abortError();
      onRetry?.(attempt, error);
      await wait(delays[Math.min(attempt - 1, delays.length - 1)] ?? 1000, signal);
    }
  }
}

export function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
