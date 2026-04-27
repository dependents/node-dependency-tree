import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { fixtures } from './helpers.mjs';

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

  describe('--list-form output', () => {
    it('prints one dependency per line in post-order', () => {
      // amd/a.js -> b.js -> c.js; post-order: c.js, b.js, a.js
      const dir = fixtures('amd');
      const entry = fixtures('amd', 'a.js');

      const result = spawnSync(
        process.execPath,
        [cliPath, '--directory', dir, '--list-form', entry],
        { encoding: 'utf8' }
      );

      assert.equal(result.status, 0, result.stderr);

      const lines = result.stdout.trimEnd().split('\n');

      assert.equal(lines.length, 3);
      assert.equal(path.resolve(lines.at(-1)), path.resolve(entry));
    });
  });
});
