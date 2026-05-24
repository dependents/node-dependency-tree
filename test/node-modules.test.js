import path from 'node:path';
import { describe, it, expect } from 'vitest';
import dependencyTree from '../index.js';
import { fixtures } from './helpers.js';

describe('package-specific node_modules resolution', () => {
  const directory = fixtures('es6', 'parentChild');
  const filename = path.normalize(`${directory}/module.entry.js`);
  const rootChildPath = path.normalize(`${directory}/node_modules/child_node_module/index.main.js`);
  const nestedChildPath = path.normalize(`${directory}/node_modules/parent_module_a/node_modules/child_node_module/index.main.js`);

  it('finds sub package in node module package', () => {
    const treeList = dependencyTree({
      filename,
      directory,
      isListForm: true
    });

    expect(treeList).toContain(nestedChildPath);
  });

  it('uses correct version of sub package in node module package', () => {
    const treeList = dependencyTree({
      filename,
      directory,
      isListForm: true
    });

    expect(treeList).not.toContain(rootChildPath);
    expect(treeList).toContain(nestedChildPath);
  });

  it('falls back to entry directory when a node_modules file has no package subpath', () => {
    const baseDir = fixtures('flat-nm');
    const filename = path.normalize(`${baseDir}/a.js`);

    const tree = dependencyTree({ filename, directory: baseDir });
    const subTree = tree[filename];
    const deps = Object.keys(subTree);

    expect(deps.some(dep => dep.includes('flatmod'))).toBe(true);
  });

  it('resolves the project path for a scoped node_modules package', () => {
    const baseDir = fixtures('scoped-nm');
    const filename = path.normalize(`${baseDir}/a.js`);

    const tree = dependencyTree({ filename, directory: baseDir });
    const subTree = tree[filename];
    const deps = Object.keys(subTree);

    expect(deps.some(dep => dep.includes(path.join('@scope', 'pkg')))).toBe(true);
  });
});
