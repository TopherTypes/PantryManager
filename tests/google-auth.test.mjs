import test from 'node:test';
import assert from 'node:assert/strict';

import { createGoogleAuthClient } from '../assets/js/platform/googleAuth.js';

function createSessionStorageStub() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

test('google auth client restores cached token metadata for active session', () => {
  const sessionStorage = createSessionStorageStub();
  const key = 'pantrymanager.google-auth';
  sessionStorage.setItem(key, JSON.stringify({ accessToken: 'cached-token', expiresAt: Date.now() + 120000 }));

  const previousSessionStorage = globalThis.sessionStorage;
  const previousGoogle = globalThis.google;

  globalThis.sessionStorage = sessionStorage;
  globalThis.google = undefined;

  const authClient = createGoogleAuthClient({
    clientId: '1234567890-test.apps.googleusercontent.com',
    scope: 'https://www.googleapis.com/auth/drive.appdata',
  });

  assert.equal(authClient.hasAccessToken(), true);
  assert.equal(authClient.getAccessToken(), 'cached-token');

  globalThis.sessionStorage = previousSessionStorage;
  globalThis.google = previousGoogle;
});

test('google auth client clears expired session token during startup hydration', () => {
  const sessionStorage = createSessionStorageStub();
  const key = 'pantrymanager.google-auth';
  sessionStorage.setItem(key, JSON.stringify({ accessToken: 'expired-token', expiresAt: Date.now() - 120000 }));

  const previousSessionStorage = globalThis.sessionStorage;
  const previousGoogle = globalThis.google;

  globalThis.sessionStorage = sessionStorage;
  globalThis.google = undefined;

  const authClient = createGoogleAuthClient({
    clientId: '1234567890-test.apps.googleusercontent.com',
    scope: 'https://www.googleapis.com/auth/drive.appdata',
  });

  assert.equal(authClient.hasAccessToken(), false);
  assert.equal(sessionStorage.getItem(key), null);

  globalThis.sessionStorage = previousSessionStorage;
  globalThis.google = previousGoogle;
});
