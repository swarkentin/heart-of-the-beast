// Unit tests for startup reads that outlast a sleeping server. Run with: npm run test:ui.
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadUntilReady, STARTUP_RETRY_DELAYS_MS } from "./startupLoad.ts";

const instant = async () => {};

test("a startup read keeps retrying until the server answers", async () => {
  let calls = 0;
  const retries: number[] = [];
  const value = await loadUntilReady(async () => { if (++calls < 4) throw new Error("502"); return "catalog"; },
    { signal: new AbortController().signal, wait: instant, onRetry: attempt => retries.push(attempt) });
  assert.equal(value, "catalog");
  assert.equal(calls, 4);
  assert.deepEqual(retries, [1, 2, 3]);
});

test("the wait between attempts backs off and then holds at the last delay", async () => {
  const waits: number[] = [];
  let calls = 0;
  await loadUntilReady(async () => { if (++calls < 8) throw new Error("down"); return 1; },
    { signal: new AbortController().signal, wait: async ms => { waits.push(ms); } });
  const last = STARTUP_RETRY_DELAYS_MS[STARTUP_RETRY_DELAYS_MS.length - 1];
  assert.deepEqual(waits, [...STARTUP_RETRY_DELAYS_MS, last, last]);
});

test("aborting stops the retries", async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(loadUntilReady(async () => { calls++; throw new Error("down"); },
    { signal: controller.signal, wait: async () => { if (calls >= 2) controller.abort(); } }), { name: "AbortError" });
  assert.equal(calls, 2);
});
