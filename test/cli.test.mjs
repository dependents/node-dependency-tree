import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(testDir, '..', 'bin', 'cli.js');

describe('dependency-tree CLI', () => {
  it('prints usage and exits when filename is missing', () => {
    const result = spawnSync(process.execPath, [cliPath], {
      encoding: 'utf8'
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /error: missing required argument 'filename'/);
    assert.match(result.stderr, /Usage: dependency-tree \[options] <filename>/);
  });
});
