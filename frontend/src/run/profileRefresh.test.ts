import assert from "node:assert/strict";
import { test } from "node:test";
import { retryUntil } from "./profileRefresh.ts";

test("profile refresh keeps retrying while the run award has not appeared", async () => {
  const stale = { adventurerXp: 120 };
  const awarded = { adventurerXp: 265 };
  const responses = [stale, stale, awarded];
  const observed: number[] = [];
  let calls = 0;

  const result = await retryUntil(
    async () => responses[calls++] ?? awarded,
    profile => profile.adventurerXp >= 265,
    profile => observed.push(profile.adventurerXp),
    { attempts: 5, delayMs: 0 },
  );

  assert.equal(result, awarded);
  assert.deepEqual(observed, [120, 120, 265]);
  assert.equal(calls, 3, "stop as soon as the award is visible");
});

test("profile refresh stops after its retry budget if the award never appears", async () => {
  const stale = { adventurerXp: 120 };
  let calls = 0;

  const result = await retryUntil(
    async () => { calls++; return stale; },
    profile => profile.adventurerXp >= 130,
    () => undefined,
    { attempts: 3, delayMs: 0 },
  );

  assert.equal(result, stale);
  assert.equal(calls, 3, "do not poll forever");
});
