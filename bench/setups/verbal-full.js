// Verbal full preset: every block, mark, UI module and AI review.
import preset from '../../dist/preset.js';
import { start } from './_verbal.js';

export const packages = ['verbal-editor', 'verbal-editor/react', 'verbal-editor/preset'];
export const mount = (el, texts) => start(el, texts, preset);
