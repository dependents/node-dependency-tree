import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import {
  describe,
  it,
  expect,
  vi
} from 'vitest';
import precinct from 'precinct';
import dependencyTree from '../index.js';
import { fixtures, testDir } from './helpers.js';

const rootDir = path.dirname(testDir);
const directory = fixtures('ts');
const filename = path.join(directory, 'a.ts');
const tsConfigPath = fixtures('ts', '.tsconfig');

/**
 * Builds a dependency tree in a child process, replacing `typescript` only after the library
 * has been imported so unrelated eager imports are unaffected. The replacement either hides
 * the module or carries a version but none of the config-parsing API.
 *
 * @param {{ hideTypeScript?: boolean, typeScriptVersion?: string }} options
 * @returns {string}
 */
function buildTreeInChildProcess(options) {
  const stub = options.hideTypeScript ?
    `if (request === 'typescript') {
       throw Object.assign(new Error("Cannot find module 'typescript'"), { code: 'MODULE_NOT_FOUND' });
     }` :
    `if (request === 'typescript') return { version: '${options.typeScriptVersion}' };`;

  const source = `
    import Module from 'node:module';

    const { default: dependencyTree } = await import('./index.js');

    const originalLoad = Module._load;
    Module._load = function(request, ...rest) {
      ${stub}

      return originalLoad.call(this, request, ...rest);
    };

    try {
      dependencyTree.toList({
        filename: ${JSON.stringify(filename)},
        directory: ${JSON.stringify(directory)},
        tsConfig: ${JSON.stringify(tsConfigPath)}
      });
      console.log('no-error');
    } catch (error) {
      console.log(error.code + ' | ' + error.message);
    }
  `;

  return execFileSync(process.execPath, ['--input-type=module', '--eval', source], {
    cwd: rootDir,
    encoding: 'utf8'
  }).trim();
}

describe('typescript peer dependency', () => {
  it('reports a missing typescript when parsing a tsConfig path', () => {
    const output = buildTreeInChildProcess({ hideTypeScript: true });

    expect(output).toContain('ERR_TYPESCRIPT_UNAVAILABLE');
    expect(output).toContain('"typescript" peer dependency');
  });

  it('reports a typescript without the config-parsing API', () => {
    const output = buildTreeInChildProcess({ typeScriptVersion: '7.0.2' });

    expect(output).toContain('ERR_TYPESCRIPT_UNAVAILABLE');
    expect(output).toContain('typescript@7.0.2 does not provide the config-parsing API');
    expect(output).toContain('readJsonConfigFile');
  });

  it('surfaces an unavailable typescript reported by precinct', () => {
    const spy = vi.spyOn(precinct, 'paperwork').mockImplementation(() => {
      throw Object.assign(new Error('detective-typescript requires the "typescript" peer dependency'), {
        code: 'ERR_TYPESCRIPT_UNAVAILABLE'
      });
    });

    expect(() => dependencyTree.toList({ filename, directory })).toThrow(/"typescript" peer dependency/);

    spy.mockRestore();
  });

  it('still swallows unrelated parse failures', () => {
    const spy = vi.spyOn(precinct, 'paperwork').mockImplementation(() => {
      throw new Error('unexpected token');
    });

    expect(dependencyTree.toList({ filename, directory })).toStrictEqual([filename]);

    spy.mockRestore();
  });
});
