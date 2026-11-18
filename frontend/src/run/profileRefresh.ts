export type RetryOptions = { attempts?: number; delayMs?: number };

export type TimestampedProfile = { updatedAt: string };

/** True only when the server says the profile changed after the captured baseline. */
export function profileUpdatedAfter(value: TimestampedProfile, baseline: TimestampedProfile): boolean {
  const updatedAt = Date.parse(value.updatedAt);
  const baselineUpdatedAt = Date.parse(baseline.updatedAt);
  return Number.isFinite(updatedAt) && Number.isFinite(baselineUpdatedAt) && updatedAt > baselineUpdatedAt;
}

/**
 * Re-read a value until it reflects an expected state. Every response is published immediately so
 * the UI can recover as soon as the server-side write becomes visible.
 */
export async function retryUntil<T>(
  load: () => Promise<T>,
  ready: (value: T) => boolean,
  onValue: (value: T) => void,
  options: RetryOptions = {},
): Promise<T | null> {
  const attempts = Math.max(1, options.attempts ?? 8);
  const delayMs = Math.max(0, options.delayMs ?? 500);
  let latest: T | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0 && delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
    try {
      latest = await load();
      onValue(latest);
      if (ready(latest)) return latest;
    } catch {
      // A transient profile request failure should not prevent the next attempt.
    }
  }
  return latest;
}
