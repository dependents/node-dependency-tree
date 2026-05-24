import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const testDir = path.dirname(fileURLToPath(import.meta.url));

export function fixtures(...parts) {
  return path.join(testDir, 'fixtures', ...parts);
}
