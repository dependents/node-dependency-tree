import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const cliPath = fileURLToPath(new URL('../bin/cli.js', import.meta.url));

describe('cli', () => {
  it('prints usage and exits when filename is missing', () => {
    const result = spawnSync(process.execPath, [cliPath], {
      encoding: 'utf8'
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /error: missing required argument 'filename'/);
    assert.match(result.stderr, /Usage: dependency-tree \[options] <filename>/);
  });
});
