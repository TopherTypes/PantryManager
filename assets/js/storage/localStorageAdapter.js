import { createStorageAdapter } from './StorageAdapter.js';

/**
 * LocalStorage-backed adapter implementation for fast MVP persistence.
 *
 * A namespace prefix is applied to avoid collisions with unrelated keys in the
 * same browser origin.
 */

/**
 * Create a namespaced localStorage adapter.
 * @template T
 * @param {string} [namespace='pantrymanager'] - Key namespace prefix.
 * @returns {import('./StorageAdapter.js').StorageAdapter<T>} Typed storage adapter.
 */
export function createLocalStorageAdapter(namespace = 'pantrymanager') {
  const withNamespace = (key) => `${namespace}:${key}`;

  return createStorageAdapter({
    readRaw(key) {
      return window.localStorage.getItem(withNamespace(key));
    },

    writeRaw(key, value) {
      window.localStorage.setItem(withNamespace(key), value);
    },

    removeRaw(key) {
      window.localStorage.removeItem(withNamespace(key));
    },
  });
}
