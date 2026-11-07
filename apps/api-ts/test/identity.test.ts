import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app';

test('current user delegates every valid bearer request to Java and fails closed', async () => {
  const previousFetch = globalThis.fetch;
  const calls: Array<{ url: string; authorization: string | null; redirect: RequestRedirect | undefined }> = [];
  const token = 'A'.repeat(43);
  let status = 200;
  let invalidJson = false;
  let unavailable = false;
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), authorization: new Headers(init?.headers).get("authorization"), redirect: init?.redirect });
    if (unavailable) throw new Error('unavailable');
    return new Response(invalidJson ? 'not json' : JSON.stringify({ username: 'synthetic', role: 'BD' }), { status });
  };
  const app = await createApp(false);
  try {
    assert.equal((await app.inject({ method: 'GET', url: '/api/me' })).statusCode, 401);
    assert.equal((await app.inject({ method: 'GET', url: '/api/me', headers: { authorization: 'Bearer invalid' } })).statusCode, 401);
    assert.equal(calls.length, 0);
    const get = () => app.inject({ method: 'GET', url: '/api/me', headers: { authorization: 'Bearer ' + token } });
    const accepted = await get();
    assert.equal(accepted.statusCode, 200);
    assert.deepEqual(accepted.json(), { username: 'synthetic', role: 'BD' });
    assert.deepEqual(calls[0], { url: 'http://api:8080/api/me', authorization: 'Bearer ' + token, redirect: 'error' });
    status = 401; assert.equal((await get()).statusCode, 401); // e.g. revoked or expired
    status = 403; assert.equal((await get()).statusCode, 403); // e.g. MFA enrollment gate
    status = 500; assert.equal((await get()).statusCode, 503);
    status = 200; invalidJson = true; assert.equal((await get()).statusCode, 503);
    invalidJson = false; unavailable = true; assert.equal((await get()).statusCode, 503);
    assert.equal(calls.length, 6);
  } finally { globalThis.fetch = previousFetch; await app.close(); }
});
