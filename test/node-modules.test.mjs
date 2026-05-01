import { strict as assert } from 'node:assert';
import path from 'node:path';
import mockfs from 'mock-fs';
import dependencyTree from '../index.js';
import { fixtures } from './helpers.mjs';

describe('package-specific node_modules resolution', () => {
  afterEach(() => {
    mockfs.restore();
  });

  it('finds sub package in node module package', () => {
    const directory = fixtures('es6');
    mockfs({
      [directory]: {
        'module.entry.js': 'import * as module from "parent_module_a"',
        node_modules: {
          parent_module_a: {
            'index.main.js': 'import * as child_module from "child_node_module"; module.exports = child_module;',
            'package.json': '{ "main": "index.main.js"}',
            node_modules: {
              child_node_module: {
                'index.main.js': 'module.exports = "child_node_module_of_parent_a"',
                'package.json': '{ "main": "index.main.js"}'
              }
            }
          }
        }
      }
    });

    const filename = path.normalize(`${directory}/module.entry.js`);
    const childPath = path.normalize(`${directory}/node_modules/parent_module_a/node_modules/child_node_module/index.main.js`);

    const treeList = dependencyTree({
      filename,
      directory,
      isListForm: true
    });

    assert.equal(treeList.includes(childPath), true);
  });

  it('uses correct version of sub package in node module package', () => {
    const directory = fixtures('es6');
    mockfs({
      [directory]: {
        'module.entry.js': 'import * as module from "parent_module_a"',
        node_modules: {
          child_node_module: {
            'index.main.js': 'module.exports = "child_node_module"',
            'package.json': '{ "main": "index.main.js", "version": "2.0.0"}'
          },
          parent_module_a: {
            'index.main.js': 'import * as child_module from "child_node_module"; module.exports = child_module;',
            'package.json': '{ "main": "index.main.js"}',
            node_modules: {
              child_node_module: {
                'index.main.js': 'module.exports = "child_node_module_of_parent_a"',
                'package.json': '{ "main": "index.main.js", "version": "1.0.0"}'
              }
            }
          }
        }
      }
    });

    const filename = path.normalize(`${directory}/module.entry.js`);
    const rootChildPath = path.normalize(`${directory}/node_modules/child_node_module/index.main.js`);
    const nestedChildPath = path.normalize(`${directory}/node_modules/parent_module_a/node_modules/child_node_module/index.main.js`);

    const treeList = dependencyTree({
      filename,
      directory,
      isListForm: true
    });

    assert.equal(treeList.includes(rootChildPath), false);
    assert.equal(treeList.includes(nestedChildPath), true);
  });

  it('falls back to entry directory when a node_modules file has no package subpath', () => {
    const baseDir = fixtures('flat-nm');

    mockfs({
      [baseDir]: {
        'a.js': 'var x = require("flatmod");',
        node_modules: {
          'flatmod.js': 'module.exports = 1;'
        }
      }
    });

    const filename = path.normalize(`${baseDir}/a.js`);

    const tree = dependencyTree({ filename, directory: baseDir });
    const subTree = tree[filename];
    const deps = Object.keys(subTree);

    assert.equal(deps.some(dep => dep.includes('flatmod')), true);
  });

  it('resolves the project path for a scoped node_modules package', () => {
    const baseDir = fixtures('scoped-nm');

    mockfs({
      [baseDir]: {
        'a.js': 'var x = require("@scope/pkg");',
        node_modules: {
          '@scope': {
            pkg: {
              'index.js': 'module.exports = 1;',
              'package.json': '{ "main": "index.js" }'
            }
          }
        }
      }
    });

    const filename = path.normalize(`${baseDir}/a.js`);

    const tree = dependencyTree({ filename, directory: baseDir });
    const subTree = tree[filename];
    const deps = Object.keys(subTree);

    assert.equal(deps.some(dep => dep.includes(path.join('@scope', 'pkg'))), true);
  });
});
