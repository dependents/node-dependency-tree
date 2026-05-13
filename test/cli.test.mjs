import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
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

  describe('--es6-mixed-imports', () => {
    it('includes both ESM and CJS dependencies from a mixed file', () => {
      const dir = fixtures('mixedImports');
      const entry = path.join(dir, 'entry.js');

      const result = spawnSync(
        process.execPath,
        [cliPath, '--directory', dir, '--es6-mixed-imports', '--list-form', entry],
        { encoding: 'utf8' }
      );

      assert.equal(result.status, 0, result.stderr);

      const lines = result.stdout.trimEnd().split('\n');
      const basenames = new Set(lines.map(line => path.basename(line)));

      assert.ok(basenames.has('esm.js'), 'esm.js should be detected');
      assert.ok(basenames.has('cjs.js'), 'cjs.js should be detected');
    });
  });

  describe('--list-form output', () => {
    it('prints one dependency per line in post-order', () => {
      // amd/a.js -> b.js -> c.js; post-order: c.js, b.js, a.js
      const dir = fixtures('amd');
      const entry = path.join(dir, 'a.js');

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
    it('does not crash where JSON.stringify would exceed V8 string length limits (issue #141)', function() {
      this.timeout(20_000);

      // Build a diamond dependency fixture: every pair at depth k requires both
      // files at depth k+1. traverse() memoises via config.visited and returns
      // the SAME JS object reference for every re-visit of a file, so
      // JSON.stringify serializes the shared subtrees exponentially - at depth 22
      // the output exceeds V8's ~512 MB string-length limit and crashes with
      // "RangeError: Invalid string length".
      const DEPTH = 22;
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-diamond-'));

      try {
        fs.writeFileSync(path.join(tmpDir, `level_${DEPTH - 1}_a.js`), '"use strict";\n');
        fs.writeFileSync(path.join(tmpDir, `level_${DEPTH - 1}_b.js`), '"use strict";\n');

        for (let k = DEPTH - 2; k >= 0; k--) {
          const content = `
            'use strict';
            const a = require('./level_${k + 1}_a');
            const b = require('./level_${k + 1}_b');
          `;

          fs.writeFileSync(path.join(tmpDir, `level_${k}_a.js`), content);
          fs.writeFileSync(path.join(tmpDir, `level_${k}_b.js`), content);
        }

        const entry = path.join(tmpDir, 'entry.js');

        fs.writeFileSync(entry, `
          'use strict';
          const a = require('./level_0_a');
          const b = require('./level_0_b');
        `);

        const result = spawnSync(
          process.execPath,
          [cliPath, '--directory', tmpDir, entry],
          { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' }
        );

        assert.equal(result.status, 0, result.stderr);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
