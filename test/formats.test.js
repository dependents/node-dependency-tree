import { strict as assert } from 'node:assert';
import path from 'node:path';
import mockfs from 'mock-fs';
import Config from '../lib/config.js';
import dependencyTree from '../index.js';
import {
  fixtures,
  mockEs6,
  mockSass,
  mockStylus,
  mockLess
} from './helpers.js';

function testTreesForFormat(format, ext = '.js') {
  it('returns an object form of the dependency tree for a file', () => {
    const directory = fixtures(format);
    const filename = path.normalize(`${directory}/a${ext}`);

    const tree = dependencyTree({ filename, directory });
    const subTree = tree[filename];

    assert.ok(tree instanceof Object);
    assert.ok(subTree instanceof Object);
    assert.equal(Object.keys(subTree).length, 2);
  });
}

describe('module formats', () => {
  afterEach(() => {
    mockfs.restore();
  });

  describe('amd', () => {
    testTreesForFormat('amd');
  });

  describe('commonjs', () => {
    testTreesForFormat('commonjs');

    describe('when given a CJS file with lazy requires', () => {
      it('includes the lazy dependency', () => {
        const directory = fixtures('cjs');
        mockfs({
          [directory]: {
            'foo.js': 'module.exports = function(bar = require("./bar")) {};',
            'bar.js': 'module.exports = 1;'
          }
        });

        const filename = path.normalize(`${directory}/foo.js`);
        const barPath = path.normalize(`${directory}/bar.js`);

        const tree = dependencyTree({ filename, directory });
        const subTree = tree[filename];
        const deps = Object.keys(subTree);

        assert.equal(deps.includes(barPath), true);
      });
    });

    describe('when given a CJS file with module property in package.json', () => {
      it('includes the module entry as dependency', () => {
        const directory = fixtures('es6');
        mockfs({
          [directory]: {
            'module.entry.js': 'import * as module from "module.entry"',
            node_modules: {
              'module.entry': {
                'index.main.js': 'module.exports = function() {};',
                'index.module.js': 'module.exports = function() {};',
                'package.json': '{ "main": "index.main.js", "module": "index.module.js" }'
              }
            }
          }
        });

        const filename = path.normalize(`${directory}/module.entry.js`);
        const moduleEntryPath = path.normalize(`${directory}/node_modules/module.entry/index.module.js`);

        const tree = dependencyTree({
          filename,
          directory,
          nodeModulesConfig: {
            entry: 'module'
          }
        });
        const subTree = tree[filename];
        const deps = Object.keys(subTree);

        assert.equal(deps.includes(moduleEntryPath), true);
      });
    });
  });

  describe('es6', () => {
    beforeEach(() => {
      mockEs6();
    });

    const directory = fixtures('es6');

    testTreesForFormat('es6');

    it('resolves files that have jsx', () => {
      const filename = path.normalize(`${directory}/jsx.js`);

      const tree = dependencyTree({ filename, directory });
      const subTree = tree[filename];

      assert.ok(subTree[path.normalize(`${directory}/c.js`)]);
    });

    it('resolves files with a jsx extension', () => {
      const filename = path.normalize(`${directory}/foo.jsx`);

      const tree = dependencyTree({ filename, directory });
      const subTree = tree[filename];

      assert.ok(subTree[path.normalize(`${directory}/b.js`)]);
    });

    it('resolves files that have es7', () => {
      const filename = path.normalize(`${directory}/es7.js`);

      const tree = dependencyTree({ filename, directory });
      const subTree = tree[filename];

      assert.ok(subTree[path.normalize(`${directory}/c.js`)]);
    });

    describe('when given an es6 file using CJS lazy requires', () => {
      beforeEach(() => {
        mockfs({
          [directory]: {
            'foo.js': 'export default function(bar = require("./bar")) {};',
            'bar.js': 'export default 1;'
          }
        });
      });

      it('includes the lazy dependency when mixedImports is on', () => {
        const filename = path.normalize(`${directory}/foo.js`);
        const barPath = path.normalize(`${directory}/bar.js`);

        const tree = dependencyTree({
          filename,
          directory,
          detective: {
            es6: {
              mixedImports: true
            }
          }
        });
        const subTree = tree[filename];
        const deps = Object.keys(subTree);

        assert.equal(deps.includes(barPath), true);
      });

      it('toList includes the lazy dependency when mixedImports is on', () => {
        const filename = path.normalize(`${directory}/foo.js`);
        const barPath = path.normalize(`${directory}/bar.js`);

        const results = dependencyTree.toList({
          filename,
          directory,
          detective: {
            es6: {
              mixedImports: true
            }
          }
        });

        assert.equal(results[0], barPath);
        assert.equal(results[1], filename);
      });

      it('does not include the lazy dependency when mixedImports is off', () => {
        const filename = path.normalize(`${directory}/foo.js`);
        const barPath = path.normalize(`${directory}/bar.js`);

        const tree = dependencyTree({ filename, directory });
        const subTree = tree[filename];
        const deps = Object.keys(subTree);

        assert.equal(deps.includes(barPath), false);
      });
    });

    describe('when given an es6 file using dynamic imports', () => {
      it('includes the dynamic import', () => {
        mockfs({
          [directory]: {
            'foo.js': 'import("./bar");',
            'bar.js': 'export default 1;'
          }
        });

        const filename = path.normalize(`${directory}/foo.js`);
        const barPath = path.normalize(`${directory}/bar.js`);

        const tree = dependencyTree({ filename, directory });
        const subTree = tree[filename];
        const deps = Object.keys(subTree);

        assert.equal(deps.includes(barPath), true);
      });
    });
  });

  describe('sass', () => {
    beforeEach(() => {
      mockSass();
    });

    testTreesForFormat('sass', '.scss');
  });

  describe('stylus', () => {
    beforeEach(() => {
      mockStylus();
    });

    testTreesForFormat('stylus', '.styl');
  });

  describe('less', () => {
    beforeEach(() => {
      mockLess();
    });

    testTreesForFormat('less', '.less');
  });

  describe('typescript', () => {
    const directory = fixtures('ts');

    testTreesForFormat('ts', '.ts');

    it('utilizes a tsconfig', () => {
      const filename = path.join(directory, 'a.ts');
      const tsConfigPath = path.join(directory, '.tsconfig');

      const results = dependencyTree.toList({
        filename,
        directory,
        tsConfig: tsConfigPath
      });

      const depB = path.join(directory, 'b.ts');
      const depC = path.join(directory, 'c.ts');

      assert.equal(results[0], depB);
      assert.equal(results[1], depC);
      assert.equal(results[2], filename);
    });

    it('supports tsx files', () => {
      const results = dependencyTree.toList({
        filename: path.join(directory, 'd.tsx'),
        directory
      });

      const depC = path.join(directory, 'c.ts');

      assert.equal(results[0], depC);
    });

    it('excludes type-only imports when skipTypeImports is set', () => {
      const filename = path.join(directory, 'type-imports.ts');
      const results = dependencyTree.toList({
        filename,
        directory,
        detective: {
          ts: {
            skipTypeImports: true
          }
        }
      });

      const regularDep = path.join(directory, 'c.ts');
      const typeOnlyDep = path.join(directory, 'b.ts');

      assert.equal(results.includes(regularDep), true);
      assert.equal(results.includes(typeOnlyDep), false);
      assert.equal(results.length, 2);
    });

    it('recognizes ts file import from js file when allowJs is on (#104)', () => {
      const directory = fixtures('ts', 'mixedTsJs');
      const filename = path.join(directory, 'a.js');
      const tsConfigPath = path.join(directory, '.tsconfig');

      const options = {
        filename,
        directory,
        tsConfig: tsConfigPath
      };
      const parsedTsConfig = new Config(options).tsConfig;

      assert.equal(parsedTsConfig.compilerOptions.allowJs, true);

      const results = dependencyTree.toList(options);

      const depB = path.join(directory, 'b.ts');

      assert.equal(results[0], depB);
    });
  });
});
