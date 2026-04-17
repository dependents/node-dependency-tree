import { strict as assert } from 'node:assert';
import path from 'node:path';
import Config from '../lib/config.js';
import dependencyTree from '../index.js';
import { fixtures } from './helpers.mjs';

describe('Config', () => {
  it('pre-parses tsconfig for performance', () => {
    const tsConfigPath = fixtures('ts', '.tsconfig');
    const config = new Config({
      filename: 'foo',
      directory: 'bar',
      tsConfig: tsConfigPath
    });

    assert.equal(typeof config.tsConfig, 'object');
  });

  it('includes tsConfigPath so filing-cabinet can resolve compilerOptions.paths', () => {
    const tsConfigPath = fixtures('ts', '.tsconfig');
    const config = new Config({
      filename: 'foo',
      directory: 'bar',
      tsConfig: tsConfigPath
    });

    assert.equal(config.tsConfigPath, tsConfigPath);
  });

  it('retains detective config in the clone', () => {
    const detectiveConfig = {
      es6: {
        mixedImports: true
      }
    };

    const config = new Config({
      detectiveConfig,
      filename: 'foo',
      directory: 'bar'
    });

    const clone = config.clone();

    assert.deepEqual(clone.detectiveConfig, detectiveConfig);
  });
});

describe('noTypeDefinitions', () => {
  const directory = fixtures('noTypeDefinitions');
  const filename = path.join(directory, 'entrypoint.ts');

  it('resolves to definition files when set to false', () => {
    const list = dependencyTree.toList({
      filename,
      directory,
      noTypeDefinitions: false
    });

    assert.ok(list.includes(path.join(directory, 'required.d.ts')));
    assert.ok(!list.includes(path.join(directory, 'required.js')));
  });

  it('resolves to JavaScript files when set to true', () => {
    const list = dependencyTree.toList({
      filename,
      directory,
      noTypeDefinitions: true
    });

    assert.ok(list.includes(path.join(directory, 'required.js')));
    assert.ok(!list.includes(path.join(directory, 'required.d.ts')));
  });
});
