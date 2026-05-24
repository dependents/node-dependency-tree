import path from 'node:path';
import { describe, it, expect } from 'vitest';
import Config from '../lib/config.js';
import dependencyTree from '../index.js';
import { fixtures } from './helpers.js';

describe('Config', () => {
  describe('with a tsConfig path', () => {
    const tsConfigPath = fixtures('ts', '.tsconfig');
    const config = new Config({
      filename: 'foo',
      directory: 'bar',
      tsConfig: tsConfigPath
    });

    it('pre-parses tsconfig for performance', () => {
      expect(config.tsConfig).toBeTypeOf('object');
    });

    it('includes tsConfigPath so filing-cabinet can resolve compilerOptions.paths', () => {
      expect(config.tsConfigPath).toBe(tsConfigPath);
    });
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

    expect(clone.detectiveConfig).toStrictEqual(detectiveConfig);
  });
});

describe('noTypeDefinitions', () => {
  const directory = fixtures('noTypeDefinitions');
  const filename = path.join(directory, 'entrypoint.ts');
  const dtsPath = path.join(directory, 'required.d.ts');
  const jsPath = path.join(directory, 'required.js');

  it('resolves to definition files when set to false', () => {
    const list = dependencyTree.toList({
      filename,
      directory,
      noTypeDefinitions: false
    });

    expect(list).toContain(dtsPath);
    expect(list).not.toContain(jsPath);
  });

  it('resolves to JavaScript files when set to true', () => {
    const list = dependencyTree.toList({
      filename,
      directory,
      noTypeDefinitions: true
    });

    expect(list).toContain(jsPath);
    expect(list).not.toContain(dtsPath);
  });
});
