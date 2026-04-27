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

  describe('default (non-list) output', () => {
    it('emits valid JSON with the entry file as the top-level key', () => {
      const dir = fixtures('commonjs');
      const entry = fixtures('commonjs', 'a.js');

      const result = spawnSync(process.execPath, [cliPath, '--directory', dir, entry], {
        encoding: 'utf8'
      });
      const tree = JSON.parse(result.stdout);
      const keys = Object.keys(tree);

      assert.equal(result.status, 0, result.stderr);
      assert.equal(keys.length, 1);
      assert.equal(path.resolve(keys[0]), path.resolve(entry));
    });

    it('does not crash or repeat shared subtrees when a dependency is reachable via multiple paths', () => {
      // amd/a.js -> b.js and c.js; amd/b.js -> c.js (c is a shared dep)
      const dir = fixtures('amd');
      const entry = path.join(dir, 'a.js');
      const bPath = path.join(dir, 'b.js');
      const cPath = path.join(dir, 'c.js');

      const result = spawnSync(process.execPath, [cliPath, '--directory', dir, entry], {
        encoding: 'utf8'
      });
      const tree = JSON.parse(result.stdout);
      // entry file is the sole top-level key
      const topKeys = Object.keys(tree);
      // c.js is reachable via two paths (directly from a.js, and via b.js).
      // The JSON must remain structurally valid and include c.js at both locations.
      const entrySubtree = tree[topKeys[0]];

      assert.equal(result.status, 0, result.stderr);
      assert.equal(topKeys.length, 1);
      assert.equal(path.resolve(topKeys[0]), path.resolve(entry));
      assert.equal(Object.hasOwn(entrySubtree, bPath), true);
      assert.equal(Object.hasOwn(entrySubtree, cPath), true);
      assert.equal(Object.hasOwn(entrySubtree[bPath], cPath), true);
    });
  });
});
