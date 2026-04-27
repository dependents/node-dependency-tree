import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const cliPath = fileURLToPath(new URL('../../bin/cli.js', import.meta.url));

describe('cli (slow)', () => {
  describe('default (non-list) output', () => {
    it('does not crash where JSON.stringify would exceed V8 string length limits (issue #141)', function() {
      this.timeout(60_000);

      // Build a diamond dependency fixture: every pair at depth k requires both
      // files at depth k+1. traverse() memoises via config.visited and returns
      // the SAME JS object reference for every re-visit of a file, so
      // JSON.stringify serializes the shared subtrees exponentially - at depth 22
      // the output exceeds V8's ~512 MB string-length limit and crashes with
      // "RangeError: Invalid string length". writeJsonToStream writes in small
      // chunks and never accumulates a single string, so it succeeds.
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
