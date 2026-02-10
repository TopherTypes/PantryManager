import test from 'node:test';
import assert from 'node:assert/strict';

import { GOOGLE_OAUTH_CONFIG, isOAuthClientConfigured } from '../assets/js/platform/googleAuthConfig.js';

test('default OAuth config classification stays aligned with placeholder marker logic', () => {
  const normalizedClientId = String(GOOGLE_OAUTH_CONFIG?.clientId || '').trim();

  // Keep this assertion resilient whether repo default is a real client id
  // or a placeholder marker. This avoids brittle CI behavior when setup changes.
  const expectedConfigurationState = Boolean(normalizedClientId)
    && !normalizedClientId.startsWith('__REPLACE_WITH_');

  assert.equal(isOAuthClientConfigured(GOOGLE_OAUTH_CONFIG), expectedConfigurationState);
});

test('isOAuthClientConfigured accepts non-placeholder client ids', () => {
  assert.equal(
    isOAuthClientConfigured({ clientId: '1234567890-example.apps.googleusercontent.com' }),
    true
  );
});
