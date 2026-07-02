import assert from 'node:assert/strict';
import test from 'node:test';
import { withRetry } from '../src/recovery';

test('retries transient failures and returns the successful result', async () => {
  let calls = 0;
  const result = await withRetry(async () => {
    calls += 1;
    if (calls < 3) throw new Error('transient');
    return 'ok';
  }, { maxAttempts: 3, baseDelayMs: 1 });
  assert.equal(result, 'ok');
  assert.equal(calls, 3);
});
