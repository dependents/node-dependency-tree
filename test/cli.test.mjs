import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { fixtures } from './helpers.mjs';

const cli = fileURLToPath(new URL('../bin/cli.js', import.meta.url));

describe('cli', () => {
  it('outputs one path per line for the list form', () => {
    const directory = fixtures('commonjs');
    const filename = path.join(directory, 'a.js');
    const result = spawnSync(
      process.execPath,
      [cli, '--directory', directory, '--list-form', filename],
      { encoding: 'utf8' }
    );

    assert.equal(result.status, 0, `CLI exited with error:\n${result.stderr}`);
    const lines = result.stdout.trim().split('\n');
    assert.ok(lines.length > 0);
    assert.ok(lines.every(l => path.isAbsolute(l)));
  });
});
