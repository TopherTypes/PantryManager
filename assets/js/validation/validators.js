/**
 * Usage:
 * - Use validator helpers directly from domain modules to keep business rules
 *   centralized and deterministic.
 * - Use `combineValidationResults` when composing multiple validation steps
 *   into one controller-facing error payload.
 */
import {
  DATE_PATTERN,
  DATETIME_UTC_PATTERN,
  ID_PATTERN,
  REQUIRED_NUTRITION_FIELDS,
  UNIT_FAMILIES,
} from './constraints.js';

/**
 * Shared canonical validators used across PantryManager services.
 *
 * All functions are deterministic and side-effect free so validation behavior
 * remains predictable in tests and in production.
 */

/**
 * @typedef {{ isValid: boolean, errors: string[] }} ValidationResult
 */

/**
 * Create a standard validation result object from collected errors.
 * @param {string[]} errors - Human-readable validation messages.
 * @returns {ValidationResult} Validation outcome object.
 */
export function toValidationResult(errors) {
  return { isValid: errors.length === 0, errors };
}

/**
 * Validate canonical entity IDs.
 * @param {string} id - Candidate entity ID.
 * @returns {ValidationResult} Result containing ID-format failures.
 */
export function validateId(id) {
  const errors = [];
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    errors.push('id must match pattern ^[a-z]+_[a-z0-9_]+_[0-9]{3,}$');
  }

  return toValidationResult(errors);
}

/**
 * Validate date-only values in YYYY-MM-DD format.
 * @param {string} date - Date-only string.
 * @returns {ValidationResult} Result for format and calendar validity.
 */
export function validateDate(date) {
  const errors = [];
  if (typeof date !== 'string' || !DATE_PATTERN.test(date)) {
    errors.push('date must use YYYY-MM-DD format');
    return toValidationResult(errors);
  }

  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
    errors.push('date must be a real calendar date');
  }

  return toValidationResult(errors);
}

/**
 * Validate UTC datetime values in YYYY-MM-DDTHH:mm:ssZ format.
 * @param {string} dateTime - Candidate UTC ISO datetime.
 * @returns {ValidationResult} Result for format and parse validity.
 */
export function validateUtcDateTime(dateTime) {
  const errors = [];
  if (typeof dateTime !== 'string' || !DATETIME_UTC_PATTERN.test(dateTime)) {
    errors.push('datetime must use UTC ISO-8601 format YYYY-MM-DDTHH:mm:ssZ');
    return toValidationResult(errors);
  }

  const parsed = new Date(dateTime);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().replace('.000', '') !== dateTime) {
    errors.push('datetime must be a valid UTC timestamp');
  }

  return toValidationResult(errors);
}

/**
 * Validate that a value is strictly greater than zero.
 * @param {number} value - Numeric quantity.
 * @param {string} fieldName - Field label for error messages.
 * @returns {ValidationResult} Quantity constraint validation result.
 */
export function validatePositiveQuantity(value, fieldName = 'quantity') {
  const errors = [];
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    errors.push(`${fieldName} must be a number greater than 0`);
  }

  return toValidationResult(errors);
}

/**
 * Validate that a value is greater than or equal to zero.
 * @param {number} value - Numeric amount.
 * @param {string} fieldName - Field label for error messages.
 * @returns {ValidationResult} Non-negative quantity validation result.
 */
export function validateNonNegativeQuantity(value, fieldName = 'quantity') {
  const errors = [];
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    errors.push(`${fieldName} must be a number greater than or equal to 0`);
  }

  return toValidationResult(errors);
}

/**
 * Validate non-negative price values.
 * @param {number} value - Price amount.
 * @param {string} fieldName - Field label for error messages.
 * @returns {ValidationResult} Price constraint validation result.
 */
export function validateNonNegativePrice(value, fieldName = 'price') {
  const errors = [];
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    errors.push(`${fieldName} must be a number greater than or equal to 0`);
  }

  return toValidationResult(errors);
}

/**
 * Build an immutable unit registry from canonical and optional custom units.
 * @param {Record<string, string[]>} [customFamilies={}] - Additional units by family.
 * @returns {Readonly<Record<string, ReadonlySet<string>>>} Family-to-unit lookup.
 */
export function buildUnitRegistry(customFamilies = {}) {
  const families = { ...UNIT_FAMILIES, ...customFamilies };
  return Object.freeze(
    Object.fromEntries(
      Object.entries(families).map(([family, units]) => [family, new Set(units)])
    )
  );
}

/**
 * Validate a unit string against the known unit registry.
 * @param {string} unit - Unit symbol to validate.
 * @param {Readonly<Record<string, ReadonlySet<string>>>} [registry] - Optional unit registry.
 * @returns {ValidationResult} Unit validation result.
 */
export function validateUnit(unit, registry = buildUnitRegistry()) {
  const errors = [];
  const knownUnits = Object.values(registry).some((units) => units.has(unit));

  if (typeof unit !== 'string' || !knownUnits) {
    errors.push('unit must exist in canonical units or registered custom units');
  }

  return toValidationResult(errors);
}

/**
 * Validate inventory nutrition payload for required per-100 fields.
 * @param {Record<string, number>} nutrition - Candidate nutrition object.
 * @returns {ValidationResult} Nutrition validation result with field-level messages.
 */
export function validateNutrition(nutrition) {
  const errors = [];

  if (!nutrition || typeof nutrition !== 'object' || Array.isArray(nutrition)) {
    errors.push('nutrition must be an object containing required per-100 fields');
    return toValidationResult(errors);
  }

  REQUIRED_NUTRITION_FIELDS.forEach((field) => {
    const value = nutrition[field];
    if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
      errors.push(`nutrition.${field} must be a number greater than or equal to 0`);
    }
  });

  return toValidationResult(errors);
}

/**
 * Combine validation outcomes into a single result.
 * @param {ValidationResult[]} results - Individual validation outputs.
 * @returns {ValidationResult} Aggregated validation state.
 */
export function combineValidationResults(results) {
  const errors = results.flatMap((result) => result.errors);
  return toValidationResult(errors);
}
