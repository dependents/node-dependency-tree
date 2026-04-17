import { strict as assert } from 'node:assert';
import path from 'node:path';
import process from 'node:process';
import mockfs from 'mock-fs';
import dependencyTree from '../index.js';
import { fixtures, testDir } from './helpers.mjs';

function assertResolvesToLodizzle(tree, entryFile) {
  const filename = path.resolve(process.cwd(), entryFile);
  const aliasedFile = path.resolve(process.cwd(), 'root/lodizzle.js').replaceAll('\\', '/');
  const normalizedTreeFilename = Object.keys(tree[filename]).map(f => f.replaceAll('\\', '/'));
  assert.ok(aliasedFile.includes(normalizedTreeFilename));
}

describe('webpack', () => {
  // Note: not mocking because webpack's resolver needs a real project with dependencies;
  // otherwise, we'd have to mock a ton of files.
  const root = path.join(testDir, '../');
  const webpackConfig = `${root}/webpack.config.js`;

  it('resolves aliased modules', () => {
    const results = dependencyTree.toList({
      filename: fixtures('webpack', 'aliased.js'),
      directory: root,
      webpackConfig,
      filter: filename => filename.includes('filing-cabinet')
    });

    assert.ok(results.some(filename => filename.includes(path.normalize('node_modules/filing-cabinet'))));
  });

  it('resolves unaliased modules', () => {
    const results = dependencyTree.toList({
      filename: fixtures('webpack', 'unaliased.js'),
      directory: root,
      webpackConfig,
      filter: filename => filename.includes('filing-cabinet')
    });

    assert.ok(results.some(filename => filename.includes(path.normalize('node_modules/filing-cabinet'))));
  });
});

describe('requirejs', () => {
  afterEach(() => {
    mockfs.restore();
  });

  beforeEach(() => {
    mockfs({
      root: {
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

  it('resolves aliased modules', () => {
    const tree = dependencyTree({
      filename: 'root/a.js',
      directory: 'root',
      config: 'root/require.config.js'
    });

    assertResolvesToLodizzle(tree, 'root/a.js');
  });

  it('resolves non-aliased paths', () => {
    const tree = dependencyTree({
      filename: 'root/b.js',
      directory: 'root',
      config: 'root/require.config.js'
    });

    assertResolvesToLodizzle(tree, 'root/b.js');
  });

  it('adds to nonExistent when the alias resolves to a path that does not exist on disk', () => {
    mockfs({
      root: {
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
      directory: 'root',
      config: 'root/require.config.js',
      nonExistent
    });

    assert.ok(nonExistent.includes('phantom'));
  });
});
