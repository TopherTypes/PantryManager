/**
 * Google OAuth client configuration for Drive sync.
 *
 * SECURITY + setup notes:
 * - This client id is safe to expose in front-end code because OAuth client ids are public identifiers.
 * - Do NOT place client secrets in front-end code.
 * - Replace the placeholder value before expecting Google Sign-In to work.
 */
export const GOOGLE_OAUTH_CONFIG = {
  /**
   * Replace this marker with your Google OAuth Web Client ID.
   * Example format: 1234567890-abc123def456.apps.googleusercontent.com
   */
  clientId: '1090517659423-98cmjomh6b4b7nntt5ckj8vhdh0e6ase.apps.googleusercontent.com',
  /**
   * Drive App Data scope keeps sync data private and app-specific.
   */
  scope: 'https://www.googleapis.com/auth/drive.appdata',
};

/**
 * Determine whether OAuth configuration has been replaced with a real client id.
 *
 * @param {{clientId?: string}} [config]
 * @returns {boolean}
 */
export function isOAuthClientConfigured(config = GOOGLE_OAUTH_CONFIG) {
  const clientId = String(config?.clientId || '').trim();
  return Boolean(clientId) && !clientId.startsWith('__REPLACE_WITH_');
}
