// Server-side validation for self-hosted builds (F-62): reject malformed documents before they are stored.
import { document, enabled } from '../config/schema.js';

/**
 * Validates a document payload against the enabled modules' schemas: known block types and marks,
 * props of the declared types, content only where a block has text, and a single tree under the root.
 * Nothing is coerced or repaired — a malformed document comes back with `error`.
 * @example const { error } = validateDoc(req.body, config); if (error) return res.status(422).json(error.details);
 * @param {unknown} doc the payload from `editor.getDoc()`
 * @param {{ blocks?: string[], marks?: string[] }} [config] a `defineConfig` result; all modules when omitted
 * @returns {{ value: object, error?: import('joi').ValidationError }}
 */
export function validateDoc(doc, config) {
  return document(enabled(config)).validate(doc, { convert: false, abortEarly: false });
}
