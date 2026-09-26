// verbal.config.js support (F-60): build-time only — it imports Joi, so never import a config from browser code.
import { config } from './schema.js';

export { available } from './schema.js';

/**
 * Validates a Verbal config and returns it with defaults applied; an invalid config throws with the
 * exact path and reason, so the build that loads it fails.
 * @example export default defineConfig({ blocks: ['heading', 'table'], marks: ['bold', 'link'], ui: ['slash'] })
 * @param {{ blocks?: string[], marks?: string[], ui?: string[], ai?: boolean, budget?: number }} options
 *   `budget` is the KB (gzip) the configured editor may weigh; `verbal doctor` fails above it.
 * @returns {{ blocks: string[], marks: string[], ui: string[], ai: boolean, budget: number }}
 */
export function defineConfig(options) {
  const { value, error } = config.validate(options, { convert: false });
  if (error) throw new Error(`Invalid Verbal config: ${error.message}`);
  return value;
}
