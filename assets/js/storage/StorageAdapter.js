/**
 * Storage adapter boundary for PantryManager persistence.
 *
 * Domain services should depend on this contract rather than browser globals,
 * enabling deterministic unit tests via in-memory adapter doubles.
 */

/**
 * @template T
 * @typedef {Object} StorageAdapter
 * @property {(key: string, fallback?: T) => T | null} get - Read and deserialize a value.
 * @property {(key: string, value: T) => void} set - Serialize and write a value.
 * @property {(key: string) => void} remove - Delete a value by key.
 */

/**
 * Create a storage adapter from primitive persistence functions.
 * @template T
 * @param {{
 *   readRaw: (key: string) => string | null,
 *   writeRaw: (key: string, value: string) => void,
 *   removeRaw: (key: string) => void,
 * }} io - Low-level string I/O primitives.
 * @returns {StorageAdapter<T>} Adapter implementing typed JSON operations.
 */
export function createStorageAdapter(io) {
  return {
    get(key, fallback = null) {
      const rawValue = io.readRaw(key);
      if (rawValue === null) {
        return fallback;
      }

      return /** @type {T} */ (JSON.parse(rawValue));
    },

    set(key, value) {
      io.writeRaw(key, JSON.stringify(value));
    },

    remove(key) {
      io.removeRaw(key);
    },
  };
}
