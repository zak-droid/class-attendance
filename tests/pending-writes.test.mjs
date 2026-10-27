import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchWithWriteTracking, hasPendingNetworkWrites } from '../app/pending-writes.ts';

test('update guard covers concurrent writes through complete response bodies and clears on failure', async t => {
  let first, second;
  const response1 = new Promise(resolve => { first = resolve; });
  const response2 = new Promise(resolve => { second = resolve; });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', () => ++calls === 1 ? response1 : response2);
  const p1 = fetchWithWriteTracking('http://localhost/save', { method: 'PATCH' });
  const p2 = fetchWithWriteTracking(new Request('http://localhost/save', { method: 'POST' }));
  assert.equal(hasPendingNetworkWrites(), true);
  first(new Response('{}')); await p1;
  assert.equal(hasPendingNetworkWrites(), true);
  let body;
  second(new Response(new ReadableStream({ start(controller) { body = controller; } })));
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(hasPendingNetworkWrites(), true);
  body.close(); await p2;
  assert.equal(hasPendingNetworkWrites(), false);
  globalThis.fetch.mock.mockImplementation(() => Promise.reject(new Error('offline')));
  await assert.rejects(fetchWithWriteTracking('http://localhost/save', { method: 'POST' }), /offline/);
  assert.equal(hasPendingNetworkWrites(), false);
});

test('ordinary reads are not treated as writes', async t => {
  t.mock.method(globalThis, 'fetch', async () => {
    assert.equal(hasPendingNetworkWrites(), false);
    return new Response('{}');
  });
  await fetchWithWriteTracking('http://localhost/read');
});
