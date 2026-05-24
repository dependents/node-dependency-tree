import path from 'node:path';
import process from 'node:process';
import { describe, it, expect } from 'vitest';
import dependencyTree from '../index.js';
import { fixtures, testDir } from './helpers.js';

function assertResolvesToLodizzle(tree, entryFile) {
  const filename = path.resolve(process.cwd(), entryFile);
  const aliasedFile = path.resolve(process.cwd(), entryFile, '..', 'lodizzle.js').replaceAll('\\', '/');
  const normalizedTreeFilename = Object.keys(tree[filename]).map(f => f.replaceAll('\\', '/'));
  expect(aliasedFile.includes(normalizedTreeFilename)).toBe(true);
}

describe('webpack', () => {
  // Note: not mocking because webpack's resolver needs a real project with dependencies;
  // otherwise, we'd have to mock a ton of files.
  const root = path.join(testDir, '../');
  const webpackConfig = fixtures('webpack.config.js');
  const filingCabinetPath = path.normalize('node_modules/filing-cabinet');

  it('resolves aliased modules', () => {
    const results = dependencyTree.toList({
      filename: fixtures('webpack', 'aliased.js'),
      directory: root,
      webpackConfig,
      filter: filename => filename.includes('filing-cabinet')
    });

    expect(results.some(filename => filename.includes(filingCabinetPath))).toBe(true);
  });

  it('resolves unaliased modules', () => {
    const results = dependencyTree.toList({
      filename: fixtures('webpack', 'unaliased.js'),
      directory: root,
      webpackConfig,
      filter: filename => filename.includes('filing-cabinet')
    });

    expect(results.some(filename => filename.includes(filingCabinetPath))).toBe(true);
  });

  it('resolves @ prefixed aliases with absolute path values', () => {
    const atAliasedSrcPath = path.normalize('webpack/src/foo.js');

    const results = dependencyTree.toList({
      filename: fixtures('webpack', 'at-aliased.js'),
      directory: root,
      webpackConfig,
      filter: filename => filename.includes(path.join('webpack', 'src'))
    });

    expect(results.some(filename => filename.includes(atAliasedSrcPath))).toBe(true);
  });
});

describe('requirejs', () => {
  const directory = fixtures('requirejs', 'root');
  const requireConfig = path.join(directory, 'require.config.js');

  it('resolves aliased modules', () => {
    const filename = path.join(directory, 'a.js');

    const tree = dependencyTree({
      filename,
      directory,
      config: requireConfig
    });

    assertResolvesToLodizzle(tree, filename);
  });

  it('resolves non-aliased paths', () => {
    const filename = path.join(directory, 'b.js');

    const tree = dependencyTree({
      filename,
      directory,
      config: requireConfig
    });

    assertResolvesToLodizzle(tree, filename);
  });

  it('adds to nonExistent when the alias resolves to a path that does not exist on disk', () => {
    const phantomDir = fixtures('requirejs', 'phantom');
    const phantomConfig = path.join(phantomDir, 'require.config.js');
    const nonExistent = [];

    dependencyTree({
      filename: path.join(phantomDir, 'a.js'),
      directory: phantomDir,
      config: phantomConfig,
      nonExistent
    });

    expect(nonExistent).toContain('phantom');
  });
});
