import path from 'node:path';
import process from 'node:process';
import mockfs from 'mock-fs';
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach
} from 'vitest';
import dependencyTree from '../index.js';
import { fixtures, testDir } from './helpers.js';

function assertResolvesToLodizzle(tree, entryFile) {
  const filename = path.resolve(process.cwd(), entryFile);
  const aliasedFile = path.resolve(process.cwd(), 'root/lodizzle.js').replaceAll('\\', '/');
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
  const directory = 'root';
  const requireConfig = 'root/require.config.js';

  beforeEach(() => {
    mockfs({
      [directory]: {
        'lodizzle.js': 'define({})',
        'require.config.js': `
          requirejs.config({
            baseUrl: './',
            paths: {
              F: './lodizzle.js'
            }
          });
        `,
        'a.js': `
          define([
            'F'
          ], function(F) {

          });
        `,
        'b.js': `
          define([
            './lodizzle'
          ], function(F) {

          });
        `
      }
    });
  });

  afterEach(() => {
    mockfs.restore();
  });

  it('resolves aliased modules', () => {
    const filename = 'root/a.js';

    const tree = dependencyTree({
      filename,
      directory,
      config: requireConfig
    });

    assertResolvesToLodizzle(tree, filename);
  });

  it('resolves non-aliased paths', () => {
    const filename = 'root/b.js';

    const tree = dependencyTree({
      filename,
      directory,
      config: requireConfig
    });

    assertResolvesToLodizzle(tree, filename);
  });

  it('adds to nonExistent when the alias resolves to a path that does not exist on disk', () => {
    mockfs({
      [directory]: {
        'a.js': 'define(["phantom"], function(p) {});',
        'require.config.js': `
          requirejs.config({
            baseUrl: './',
            paths: {
              phantom: './phantom-module'
            }
          });
        `
      }
    });

    const nonExistent = [];

    dependencyTree({
      filename: 'root/a.js',
      directory,
      config: requireConfig,
      nonExistent
    });

    expect(nonExistent).toContain('phantom');
  });
});
