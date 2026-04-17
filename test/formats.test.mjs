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
} from './helpers.mjs';

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
        mockfs({
          [fixtures('cjs')]: {
            'foo.js': 'module.exports = function(bar = require("./bar")) {};',
            'bar.js': 'module.exports = 1;'
          }
        });

        const directory = fixtures('cjs');
        const filename = path.normalize(`${directory}/foo.js`);

        const tree = dependencyTree({ filename, directory });
        const subTree = tree[filename];

        assert.ok(Object.keys(subTree).includes(path.normalize(`${directory}/bar.js`)));
      });
    });

    describe('when given a CJS file with module property in package.json', () => {
      it('includes the module entry as dependency', () => {
        mockfs({
          [fixtures('es6')]: {
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

        const directory = fixtures('es6');
        const filename = path.normalize(`${directory}/module.entry.js`);

        const tree = dependencyTree({
          filename,
          directory,
          nodeModulesConfig: {
            entry: 'module'
          }
        });
        const subTree = tree[filename];

        assert.ok(Object.keys(subTree).includes(path.normalize(`${directory}/node_modules/module.entry/index.module.js`)));
      });
    });
  });

  describe('es6', () => {
    const directory = fixtures('es6');

    beforeEach(() => {
      mockEs6();
    });

    testTreesForFormat('es6');

    it('resolves files that have jsx', () => {
      const filename = path.normalize(`${directory}/jsx.js`);
      const { [filename]: tree } = dependencyTree({ filename, directory });

      assert.ok(tree[path.normalize(`${directory}/c.js`)]);
    });

    it('resolves files with a jsx extension', () => {
      const filename = path.normalize(`${directory}/foo.jsx`);
      const { [filename]: tree } = dependencyTree({
        filename,
        directory
      });

      assert.ok(tree[path.normalize(`${directory}/b.js`)]);
    });

    it('resolves files that have es7', () => {
      const filename = path.normalize(`${directory}/es7.js`);
      const { [filename]: tree } = dependencyTree({
        filename,
        directory
      });

      assert.ok(tree[path.normalize(`${directory}/c.js`)]);
    });

    describe('when given an es6 file using CJS lazy requires', () => {
      beforeEach(() => {
        mockfs({
          [fixtures('es6')]: {
            'foo.js': 'export default function(bar = require("./bar")) {};',
            'bar.js': 'export default 1;'
          }
        });
      });

      it('includes the lazy dependency when mixedImports is on', () => {
        const filename = path.normalize(`${directory}/foo.js`);

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

        assert.ok(Object.keys(subTree).includes(path.normalize(`${directory}/bar.js`)));
      });

      it('toList includes the lazy dependency when mixedImports is on', () => {
        const filename = path.normalize(`${directory}/foo.js`);

        const results = dependencyTree.toList({
          filename,
          directory,
          detective: {
            es6: {
              mixedImports: true
            }
          }
        });

        assert.equal(results[0], path.normalize(`${directory}/bar.js`));
        assert.equal(results[1], filename);
      });

      it('does not include the lazy dependency when mixedImports is off', () => {
        const filename = path.normalize(`${directory}/foo.js`);

        const tree = dependencyTree({ filename, directory });
        const subTree = tree[filename];

        assert.ok(!Object.keys(subTree).includes(path.normalize(`${directory}/bar.js`)));
      });
    });

    describe('when given an es6 file using dynamic imports', () => {
      it('includes the dynamic import', () => {
        mockfs({
          [fixtures('es6')]: {
            'foo.js': 'import("./bar");',
            'bar.js': 'export default 1;'
          }
        });

        const filename = path.normalize(`${directory}/foo.js`);

        const tree = dependencyTree({ filename, directory });
        const subTree = tree[filename];

        assert.ok(Object.keys(subTree).includes(path.normalize(`${directory}/bar.js`)));
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
    testTreesForFormat('ts', '.ts');

    it('utilizes a tsconfig', () => {
      const directory = fixtures('ts');
      const tsConfigPath = path.join(directory, '.tsconfig');

      const results = dependencyTree.toList({
        filename: fixtures('ts', 'a.ts'),
        directory,
        tsConfig: tsConfigPath
      });

      assert.equal(results[0], path.join(directory, 'b.ts'));
      assert.equal(results[1], path.join(directory, 'c.ts'));
      assert.equal(results[2], path.join(directory, 'a.ts'));
    });

    it('supports tsx files', () => {
      const directory = fixtures('ts');

      const results = dependencyTree.toList({
        filename: fixtures('ts', 'd.tsx'),
        directory
      });

      assert.equal(results[0], path.join(directory, 'c.ts'));
    });

    it('recognizes ts file import from js file when allowJs is on (#104)', () => {
      const directory = fixtures('ts', 'mixedTsJs');
      const tsConfigPath = path.join(directory, '.tsconfig');

      const options = {
        filename: `${directory}/a.js`,
        directory,
        tsConfig: tsConfigPath
      };

      const parsedTsConfig = new Config(options).tsConfig;

      assert.ok(parsedTsConfig.compilerOptions.allowJs);

      const results = dependencyTree.toList({
        filename: `${directory}/a.js`,
        directory,
        tsConfig: tsConfigPath
      });

      assert.equal(results[0], path.join(directory, 'b.ts'));
    });
  });
});
