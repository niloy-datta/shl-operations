import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app';
import { parsePort } from '@shl/config';
test('process health and server-generated request IDs', async () => {
  const app = await createApp(false);
  try {
    for (const url of ['/health/live', '/health/ready']) {
      const res = await app.inject({ method: 'GET', url, headers: { 'x-request-id': 'untrusted' } });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.json(), { status: 'ok', scope: 'process' });
      assert.notEqual(res.headers['x-request-id'], 'untrusted');
      assert.equal(res.headers['cache-control'], 'no-store');
    }
  } finally { await app.close(); }
});
test('business routes are unavailable and errors are structured', async () => {
  const app = await createApp(false);
  try {
    const res = await app.inject({ method: 'GET', url: '/api/customers' });
    assert.equal(res.statusCode, 404);
    assert.equal(res.json().error, 'Not Found');
    assert.equal(res.json().requestId, res.headers['x-request-id']);
  } finally { await app.close(); }
});
test('port configuration rejects invalid values', () => {
  assert.equal(parsePort(undefined), 8081);
  for (const value of ['', '0', '65536', '-1', '1.5', 'abc']) assert.throws(() => parsePort(value));
});

test('OpenAPI describes health and the bearer-protected identity bridge', async () => {
  const app = await createApp(false);
  try {
    const res = await app.inject({ method: 'GET', url: '/openapi-json' });
    assert.equal(res.statusCode, 200);
    assert.ok(res.json().paths['/health/live']);
    assert.ok(res.json().paths['/api/me']);
    assert.ok(res.json().paths['/api/me'].get.security);
  } finally { await app.close(); }
});
