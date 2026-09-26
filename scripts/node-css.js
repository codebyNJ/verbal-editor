// Lets Node import the package source: a CSS import becomes a module whose class names are their own keys.
import { register } from 'node:module';

const hook = `export const load = (url, context, next) => url.endsWith('.css')
  ? { format: 'module', source: 'export default new Proxy({}, { get: (_, k) => k });', shortCircuit: true }
  : next(url, context);`;
register(`data:text/javascript,${encodeURIComponent(hook)}`);
