import test from 'node:test';
import assert from 'node:assert/strict';

import { GOOGLE_OAUTH_CONFIG, isOAuthClientConfigured } from '../assets/js/platform/googleAuthConfig.js';

test('default OAuth config remains intentionally unconfigured until user replaces marker', () => {
  assert.equal(isOAuthClientConfigured(GOOGLE_OAUTH_CONFIG), false);
});

test('isOAuthClientConfigured accepts non-placeholder client ids', () => {
  assert.equal(
    isOAuthClientConfigured({ clientId: '1234567890-example.apps.googleusercontent.com' }),
    true
  );
});
