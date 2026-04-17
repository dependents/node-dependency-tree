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

  it('does not re-expand shared subtrees in JSON output (diamond graph)', () => {
    // Diamond: a->{b,c}, b->c, c->d. traverse() returns the cached c subtree on the
    // second visit, so JSON.stringify would re-expand it without the CLI's replacer.
    const directory = fixtures('shared');
    const filename = path.join(directory, 'a.js');
    const result = spawnSync(
      process.execPath,
      [cli, '--directory', directory, filename],
      { encoding: 'utf8' }
    );

    assert.equal(result.status, 0, `CLI exited with error:\n${result.stderr}`);

    const dPath = path.join(directory, 'd.js');
    const escapedD = JSON.stringify(dPath).slice(1, -1);
    const occurrences = result.stdout.split(escapedD).length - 1;
    assert.equal(occurrences, 1, `d.js appears ${occurrences} times in JSON output; shared subtree re-expanded`);
  });
});
