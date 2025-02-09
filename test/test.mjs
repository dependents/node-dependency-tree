/* eslint-env mocha */

import { strict as assert } from 'node:assert';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import mockfs from 'mock-fs';
import precinct from 'precinct';
import sinon from 'sinon';
import Config from '../lib/config.js';
import dependencyTree from '../index.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let _directory;

function testTreesForFormat(format, ext = '.js') {
  it('returns an object form of the dependency tree for a file', () => {
    const root = path.join(__dirname, `/fixtures/${format}`);
    const filename = path.normalize(`${root}/a${ext}`);

    const tree = dependencyTree({ filename, root });
    const aSubTree = tree[filename];
    const filesInSubTree = Object.keys(aSubTree);

    assert.ok(tree instanceof Object);
    assert.ok(aSubTree instanceof Object);
    assert.equal(filesInSubTree.length, 2);
  });
}

function mockStylus() {
  mockfs({
    [path.join(__dirname, '/fixtures/stylus')]: {
      'a.styl': `
          @import "b"
          @require "c.styl"
        `,
      'b.styl': '@import "c"',
      'c.styl': ''
    }
  });
}

function mockSass() {
  mockfs({
    [path.join(__dirname, '/fixtures/sass')]: {
      'a.scss': `
          @import "_b";
          @import "_c.scss";
        `,
      '_b.scss': 'body { color: blue; }',
      '_c.scss': 'body { color: pink; }'
    }
  });
}

function mockLess() {
  mockfs({
    [path.join(__dirname, '/fixtures/less')]: {
      'a.less': `
          @import "b.css";
          @import "c.less";
        `,
      'b.css': 'body { color: blue; }',
      'c.less': 'body { color: pink; }'
    }
  });
}

function mockEs6() {
  mockfs({
    [path.join(__dirname, '/fixtures/es6')]: {
      'a.js': `
          import b from './b';
          import c from './c';
        `,
      'b.js': 'export default function() {};',
      'c.js': 'export default function() {};',
      'jsx.js': 'import c from "./c";\n export default <jsx />;',
      'foo.jsx': 'import React from "react";\n import b from "b";\n export default <jsx />;',
      'es7.js': 'import c from "./c";\n export default async function foo() {};'
    }
  });
}

describe('dependencyTree', () => {
  afterEach(() => {
    mockfs.restore();
  });

  it('returns an empty object for a non-existent filename', () => {
    mockfs({
      imaginary: {}
    });

    const root = path.join(__dirname, '/imaginary');
    const filename = `${root}/notafile.js`;
    const tree = dependencyTree({ filename, root });

    assert.ok(tree instanceof Object);
    assert.equal(Object.keys(tree).length, 0);
  });

  it('handles nested tree structures', () => {
    const directory = path.join(__dirname, '/fixtures/extended');
    const filename = path.normalize(`${directory}/a.js`);

    const tree = dependencyTree({ filename, directory });
    assert.ok(tree[filename] instanceof Object);

    // b and c
    const subTree = tree[filename];
    assert.equal(Object.keys(subTree).length, 2);

    const bTree = subTree[path.normalize(`${directory}/b.js`)];
    const cTree = subTree[path.normalize(`${directory}/c.js`)];
    // d and e
    assert.equal(Object.keys(bTree).length, 2);
    // f ang g
    assert.equal(Object.keys(cTree).length, 2);
  });

  it('does not include files that are not real (#13)', () => {
    mockfs({
      [path.join(__dirname, '/onlyRealDeps')]: {
        'a.js': 'var notReal = require("./notReal");'
      }
    });

    const directory = path.join(__dirname, '/onlyRealDeps');
    const filename = path.normalize(`${directory}/a.js`);

    const tree = dependencyTree({ filename, directory });
    const subTree = tree[filename];

    assert.ok(!Object.keys(subTree).includes('notReal'));
  });

  it('test includeNonExisting=true', () => {
    const directory = path.join(__dirname, '/fixtures/onlyRealDeps');
    const filename = path.normalize(`${directory}/a.js`);

    const tree = dependencyTree({ filename, directory, includeNonExisting: true });
    const subTree = tree[filename];

    assert.ok(Object.keys(subTree).includes(':!EXISTS: not-real'));
  });

  it('test includeCore=true', () => {
    const directory = path.join(__dirname, '/fixtures/onlyRealDeps');
    const filename = path.normalize(`${directory}/a.js`);

    const tree = dependencyTree({ filename, directory, includeCore: true });
    const subTree = tree[filename];

    assert.ok(Object.keys(subTree).includes(':!EXISTS: path'));
  });

  it('does not choke on cyclic dependencies', () => {
    mockfs({
      [path.join(__dirname, '/cyclic')]: {
        'a.js': 'var b = require("./b");',
        'b.js': 'var a = require("./a");'
      }
    });

    const directory = path.join(__dirname, '/cyclic');
    const filename = path.normalize(`${directory}/a.js`);

    const spy = sinon.spy(dependencyTree, '_getDependencies');

    const tree = dependencyTree({ filename, directory });

    assert.equal(spy.callCount, 2);
    assert.ok(Object.keys(tree[filename]).length > 0);

    dependencyTree._getDependencies.restore();
  });

  it('excludes Node.js core modules by default', () => {
    const directory = path.join(__dirname, '/fixtures/commonjs');
    const filename = path.normalize(`${directory}/b.js`);

    const tree = dependencyTree({ filename, directory });
    assert.equal(Object.keys(tree[filename]).length, 0);
    assert.ok(Object.keys(tree)[0].includes('b.js'));
  });

  it('traverses installed 3rd party node modules', () => {
    const directory = path.join(__dirname, '/fixtures/onlyRealDeps');
    const filename = path.normalize(`${directory}/a.js`);

    const tree = dependencyTree({ filename, directory });
    const subTree = tree[filename];

    assert.ok(Object.keys(subTree).includes(require.resolve('debug')));
  });

  it('returns a list of absolutely pathed files', () => {
    const directory = path.join(__dirname, '/fixtures/commonjs');
    const filename = path.normalize(`${directory}/b.js`);

    const tree = dependencyTree({ filename, directory });

    for (const node in tree.nodes) {
      if (Object.hasOwn(tree.nodes, node)) {
        assert.ok(node.includes(process.cwd()));
      }
    }
  });

  it('excludes duplicate modules from the tree', () => {
    mockfs({
      root: {
        // More than one module includes c
        'a.js': `import b from "b";
                 import c from "c";`,
        'b.js': 'import c from "c";',
        'c.js': 'export default 1;'
      }
    });

    const tree = dependencyTree.toList({
      filename: 'root/a.js',
      directory: 'root'
    });

    assert.equal(tree.length, 3);
  });

  it('resolves TypeScript imports to their type definition files by default', () => {
    const directory = path.join(__dirname, 'fixtures', 'noTypeDefinitions');
    const filename = path.join(directory, 'entrypoint.ts');

    const list = dependencyTree.toList({ filename, directory });

    assert.ok(list.includes(path.join(directory, 'required.d.ts')));
    assert.ok(!list.includes(path.join(directory, 'required.js')));
  });

  describe('when given a detective configuration', () => {
    it('passes it through to precinct', () => {
      const spy = sinon.spy(precinct, 'paperwork');
      const directory = path.join(__dirname, '/fixtures/onlyRealDeps');
      const filename = path.normalize(`${directory}/a.js`);
      const detectiveConfig = {
        amd: {
          skipLazyLoaded: true
        }
      };

      dependencyTree({
        filename,
        directory,
        detective: detectiveConfig
      });

      assert.ok(spy.calledWith(filename, detectiveConfig));
      spy.restore();
    });
  });

  describe('when given a list to store non existent partials', () => {
    describe('and the file contains no valid partials', () => {
      it('stores the invalid partials', () => {
        mockfs({
          [path.join(__dirname, '/onlyRealDeps')]: {
            'a.js': 'var notReal = require("./notReal");'
          }
        });

        const directory = path.join(__dirname, '/onlyRealDeps');
        const filename = path.normalize(`${directory}/a.js`);
        const nonExistent = [];

        dependencyTree({ filename, directory, nonExistent });

        assert.equal(nonExistent.length, 1);
        assert.equal(nonExistent[0], './notReal');
      });
    });

    describe('and the file contains all valid partials', () => {
      it('does not store anything', () => {
        mockfs({
          [path.join(__dirname, '/onlyRealDeps')]: {
            'a.js': 'var b = require("./b");',
            'b.js': 'export default 1;'
          }
        });

        const directory = path.join(__dirname, '/onlyRealDeps');
        const filename = path.normalize(`${directory}/a.js`);
        const nonExistent = [];

        dependencyTree({ filename, directory, nonExistent });

        assert.equal(nonExistent.length, 0);
      });
    });

    describe('and the file contains a mix of invalid and valid partials', () => {
      it('stores the invalid ones', () => {
        mockfs({
          [path.join(__dirname, '/onlyRealDeps')]: {
            'a.js': 'var b = require("./b");',
            'b.js': 'var c = require("./c"); export default 1;',
            'c.js': 'var crap = require("./notRealMan");'
          }
        });

        const directory = path.join(__dirname, '/onlyRealDeps');
        const filename = path.normalize(`${directory}/a.js`);
        const nonExistent = [];

        dependencyTree({ filename, directory, nonExistent });

        assert.equal(nonExistent.length, 1);
        assert.equal(nonExistent[0], './notRealMan');
      });
    });

    describe('and there is more than one reference to the invalid partial', () => {
      it('only includes the non-existent partial once', () => {
        mockfs({
          [path.join(__dirname, '/onlyRealDeps')]: {
            'a.js': 'var b = require("./b");\nvar crap = require("./notRealMan");',
            'b.js': 'var c = require("./c"); export default 1;',
            'c.js': 'var crap = require("./notRealMan");'
          }
        });

        const directory = path.join(__dirname, '/onlyRealDeps');
        const filename = path.normalize(`${directory}/a.js`);
        const nonExistent = [];

        dependencyTree({ filename, directory, nonExistent });

        assert.equal(nonExistent.length, 1);
        assert.equal(nonExistent[0], './notRealMan');
      });
    });
  });

  describe('throws', () => {
    beforeEach(() => {
      _directory = path.join(__dirname, '/fixtures/commonjs');
    });

    it('throws if the filename is missing', () => {
      assert.throws(() => {
        dependencyTree({
          filename: undefined,
          directory: _directory
        });
      }, /^Error: filename not given$/);
    });

    it('throws if the root is missing', () => {
      assert.throws(() => {
        dependencyTree({ undefined });
      }, /^Error: filename not given$/);
    });

    it('throws if the directory is missing', () => {
      assert.throws(() => {
        dependencyTree({ filename: 'foo.js', directory: undefined });
      }, /^Error: directory not given$/);
    });

    it('throws if a supplied filter is not a function', () => {
      const directory = path.join(__dirname, '/fixtures/onlyRealDeps');
      const filename = path.normalize(`${directory}/a.js`);

      assert.throws(() => {
        dependencyTree({
          filename,
          directory,
          filter: 'foobar'
        });
      }, /^Error: filter must be a function$/);
    });

    it('does not throw on the legacy `root` option', () => {
      assert.doesNotThrow(() => {
        const directory = path.join(__dirname, '/fixtures/onlyRealDeps');
        const filename = path.normalize(`${directory}/a.js`);

        dependencyTree({
          filename,
          root: directory
        });
      });
    });
  });

  describe('on file error', () => {
    beforeEach(() => {
      _directory = path.join(__dirname, '/fixtures/commonjs');
    });

    it('does not throw', () => {
      assert.doesNotThrow(() => {
        dependencyTree({
          filename: 'foo',
          directory: _directory
        });
      });
    });

    it('returns no dependencies', () => {
      const tree = dependencyTree({ filename: 'foo', directory: _directory });
      // eslint-disable-next-line unicorn/explicit-length-check
      assert.ok(!tree.length);
    });
  });

  describe('when a filter function is supplied', () => {
    it('uses the filter to determine if a file should be included in the results', () => {
      const directory = path.join(__dirname, '/fixtures/onlyRealDeps');
      const filename = path.normalize(`${directory}/a.js`);

      const tree = dependencyTree({
        filename,
        directory,
        // Skip all 3rd party deps
        filter(filePath, moduleFile) {
          assert.ok(require.resolve('debug'));
          assert.ok(moduleFile.replaceAll('\\', '/').match(path.normalize('test/fixtures/onlyRealDeps/a.js').replaceAll('\\', '/')));
          return !filePath.includes('node_modules');
        }
      });

      const subTree = tree[filename];
      assert.ok(Object.keys(tree).length > 0);

      const has3rdPartyDep = Object.keys(subTree).includes(require.resolve('debug'));
      assert.ok(!has3rdPartyDep);
    });
  });

  describe('memoization (#2)', () => {
    let _spy;

    beforeEach(() => {
      _spy = sinon.spy(dependencyTree, '_getDependencies');
    });

    afterEach(() => {
      dependencyTree._getDependencies.restore();
    });

    it('accepts a cache object for memoization (#2)', () => {
      const filename = path.join(__dirname, '/fixtures/amd/a.js');
      const directory = path.join(__dirname, '/fixtures/amd');
      const cache = {};

      cache[path.join(__dirname, '/fixtures/amd/b.js')] = [
        path.join(__dirname, '/fixtures/amd/b.js'),
        path.join(__dirname, '/fixtures/amd/c.js')
      ];

      const tree = dependencyTree({
        filename,
        directory,
        visited: cache
      });

      assert.equal(Object.keys(tree[filename]).length, 2);
      assert.ok(_spy.neverCalledWith(path.join(__dirname, '/fixtures/amd/b.js')));
    });

    it('returns the precomputed list of a cached entry point', () => {
      const filename = path.join(__dirname, '/fixtures/amd/a.js');
      const directory = path.join(__dirname, '/fixtures/amd');

      const cache = {
        [filename]: [] // Shouldn't process the first file's tree
      };

      const tree = dependencyTree({
        filename,
        directory,
        visited: cache
      });

      // eslint-disable-next-line unicorn/explicit-length-check
      assert.ok(!tree.length);
    });
  });

  describe('it uses package specific node_module directory when resolving package dependencies', () => {
    testTreesForFormat('commonjs');

    it('it can find sub package in node module package', () => {
      mockfs({
        [path.join(__dirname, '/es6')]: {
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

      const directory = path.join(__dirname, '/es6');
      const filename = path.normalize(`${directory}/module.entry.js`);

      const treeList = dependencyTree({
        filename,
        directory,
        isListForm: true
      });

      assert.ok(treeList.includes(path.normalize(`${directory}/node_modules/parent_module_a/node_modules/child_node_module/index.main.js`)));
    });

    it('it uses correct version of sub package in node module package', () => {
      mockfs({
        [path.join(__dirname, '/es6')]: {
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

      const directory = path.join(__dirname, '/es6');
      const filename = path.normalize(`${directory}/module.entry.js`);

      const treeList = dependencyTree({
        filename,
        directory,
        isListForm: true
      });

      assert.ok(!treeList.includes(path.normalize(`${directory}/node_modules/child_node_module/index.main.js`)));
      assert.ok(treeList.includes(path.normalize(`${directory}/node_modules/parent_module_a/node_modules/child_node_module/index.main.js`)));
    });
  });

  describe('module formats', () => {
    describe('amd', () => {
      testTreesForFormat('amd');
    });

    describe('commonjs', () => {
      testTreesForFormat('commonjs');

      describe('when given a CJS file with lazy requires', () => {
        beforeEach(() => {
          mockfs({
            [path.join(__dirname, '/cjs')]: {
              'foo.js': 'module.exports = function(bar = require("./bar")) {};',
              'bar.js': 'module.exports = 1;'
            }
          });
        });

        it('includes the lazy dependency', () => {
          const directory = path.join(__dirname, '/cjs');
          const filename = path.normalize(`${directory}/foo.js`);

          const tree = dependencyTree({ filename, directory });
          const subTree = tree[filename];

          assert.ok(Object.keys(subTree).includes(path.normalize(`${directory}/bar.js`)));
        });
      });

      describe('when given a CJS file with module property in package.json', () => {
        beforeEach(() => {
          mockfs({
            [path.join(__dirname, '/es6')]: {
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
        });

        it('it includes the module entry as dependency', () => {
          const directory = path.join(__dirname, '/es6');
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
      beforeEach(() => {
        _directory = path.join(__dirname, '/fixtures/es6');
        mockEs6();
      });

      testTreesForFormat('es6');

      it('resolves files that have jsx', () => {
        const filename = path.normalize(`${_directory}/jsx.js`);
        const { [filename]: tree } = dependencyTree({
          filename,
          directory: _directory
        });

        assert.ok(tree[path.normalize(`${_directory}/c.js`)]);
      });

      it('resolves files with a jsx extension', () => {
        const filename = path.normalize(`${_directory}/foo.jsx`);
        const { [filename]: tree } = dependencyTree({
          filename,
          directory: _directory
        });

        assert.ok(tree[path.normalize(`${_directory}/b.js`)]);
      });

      it('resolves files that have es7', () => {
        const filename = path.normalize(`${_directory}/es7.js`);
        const { [filename]: tree } = dependencyTree({
          filename,
          directory: _directory
        });

        assert.ok(tree[path.normalize(`${_directory}/c.js`)]);
      });

      describe('when given an es6 file using CJS lazy requires', () => {
        beforeEach(() => {
          mockfs({
            [path.join(__dirname, '/es6')]: {
              'foo.js': 'export default function(bar = require("./bar")) {};',
              'bar.js': 'export default 1;'
            }
          });
        });

        describe('and mixedImport mode is turned on', () => {
          it('includes the lazy dependency', () => {
            const directory = path.join(__dirname, '/es6');
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

          it('also works for toList', () => {
            const directory = path.join(__dirname, '/es6');
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
        });

        describe('and mixedImport mode is turned off', () => {
          it('does not include the lazy dependency', () => {
            const directory = path.join(__dirname, '/es6');
            const filename = path.normalize(`${directory}/foo.js`);

            const tree = dependencyTree({
              filename,
              directory
            });

            const subTree = tree[filename];

            assert.ok(!Object.keys(subTree).includes(path.normalize(`${directory}/bar.js`)));
          });
        });
      });

      describe('when given an es6 file using dynamic imports', () => {
        beforeEach(() => {
          mockfs({
            [path.join(__dirname, '/es6')]: {
              'foo.js': 'import("./bar");',
              'bar.js': 'export default 1;'
            }
          });
        });

        it('includes the dynamic import', () => {
          const directory = path.join(__dirname, '/es6');
          const filename = path.normalize(`${directory}/foo.js`);

          const tree = dependencyTree({
            filename,
            directory
          });

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
        const directory = path.join(__dirname, 'fixtures/ts');
        const tsConfigPath = path.join(directory, '.tsconfig');

        const results = dependencyTree.toList({
          filename: path.join(__dirname, '/fixtures/ts/a.ts'),
          directory,
          tsConfig: tsConfigPath
        });

        assert.equal(results[0], path.join(directory, 'b.ts'));
        assert.equal(results[1], path.join(directory, 'c.ts'));
        assert.equal(results[2], path.join(directory, 'a.ts'));
      });

      it('supports tsx files', () => {
        const directory = path.join(__dirname, 'fixtures/ts');

        const results = dependencyTree.toList({
          filename: path.join(__dirname, '/fixtures/ts/d.tsx'),
          directory
        });

        assert.equal(results[0], path.join(directory, 'c.ts'));
      });

      it('recognizes a ts file import from a js file (#104) is allowJs is on', () => {
        const directory = path.join(__dirname, 'fixtures/ts/mixedTsJs');
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

  describe('toList', () => {
    function testToList(format, ext = '.js') {
      it('returns a post-order list form of the dependency tree', () => {
        const directory = path.join(__dirname, `/fixtures/${format}`);
        const filename = path.normalize(`${directory}/a${ext}`);

        const list = dependencyTree.toList({
          filename,
          directory
        });

        assert.ok(Array.isArray(list));
        assert.ok(list.length > 0);
      });
    }

    it('returns an empty list on a non-existent filename', () => {
      mockfs({
        imaginary: {}
      });

      const directory = path.join(__dirname, '/imaginary');
      const filename = path.normalize(`${directory}/notafile.js`);

      const list = dependencyTree.toList({
        filename,
        directory
      });

      assert.ok(Array.isArray(list));
      assert.equal(list.length, 0);
    });

    it('orders the visited files by last visited', () => {
      const directory = path.join(__dirname, '/fixtures/amd');
      const filename = path.normalize(`${directory}/a.js`);
      const list = dependencyTree.toList({
        filename,
        directory
      });

      assert.equal(list.length, 3);
      assert.equal(path.normalize(list[0]), path.normalize(`${directory}/c.js`));
      assert.equal(path.normalize(list[1]), path.normalize(`${directory}/b.js`));
      assert.equal(list.at(-1), filename);
    });

    describe('module formats', () => {
      describe('amd', () => {
        testToList('amd');
      });

      describe('commonjs', () => {
        testToList('commonjs');
      });

      describe('es6', () => {
        beforeEach(() => {
          mockEs6();
        });

        testToList('es6');
      });

      describe('sass', () => {
        beforeEach(() => {
          mockSass();
        });

        testToList('sass', '.scss');
      });

      describe('stylus', () => {
        beforeEach(() => {
          mockStylus();
        });

        testToList('stylus', '.styl');
      });

      describe('less', () => {
        beforeEach(() => {
          mockLess();
        });

        testToList('less', '.less');
      });

      describe('typescript', () => {
        testToList('ts', '.ts');
      });
    });
  });

  describe('webpack', () => {
    let testResolution;

    beforeEach(() => {
      // Note: not mocking because webpack's resolver needs a real project with dependencies;
      // otherwise, we'd have to mock a ton of files.
      const root = path.join(__dirname, '../');
      const webpackConfig = `${root}/webpack.config.js`;

      testResolution = name => {
        const results = dependencyTree.toList({
          filename: path.join(__dirname, `/fixtures/webpack/${name}.js`),
          directory: root,
          webpackConfig,
          filter: filename => filename.includes('filing-cabinet')
        });

        assert.ok(results.some(filename => filename.includes(path.normalize('node_modules/filing-cabinet'))));
      };
    });

    it('resolves aliased modules', () => {
      testResolution('aliased');
    });

    it('resolves unaliased modules', () => {
      testResolution('unaliased');
    });
  });

  describe('requirejs', () => {
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

      const filename = path.resolve(process.cwd(), 'root/a.js');
      const aliasedFile = path.resolve(process.cwd(), 'root/lodizzle.js').replaceAll('\\', '/');
      const normalizedTreeFilename = Object.keys(tree[filename]).map(f => f.replaceAll('\\', '/'));
      assert.ok(aliasedFile.includes(normalizedTreeFilename));
    });

    it('resolves non-aliased paths', () => {
      const tree = dependencyTree({
        filename: 'root/b.js',
        directory: 'root',
        config: 'root/require.config.js'
      });

      const filename = path.resolve(process.cwd(), 'root/b.js');
      const aliasedFile = path.resolve(process.cwd(), 'root/lodizzle.js').replaceAll('\\', '/');
      const normalizedTreeFilename = Object.keys(tree[filename]).map(f => f.replaceAll('\\', '/'));
      assert.ok(aliasedFile.includes(normalizedTreeFilename));
    });
  });

  describe('when noTypeDefinitions is set', () => {
    describe('and it is set to false', () => {
      it('resolves TypeScript imports to their definition files', () => {
        const directory = path.join(__dirname, 'fixtures', 'noTypeDefinitions');
        const filename = path.join(directory, 'entrypoint.ts');

        const list = dependencyTree.toList({ filename, directory, noTypeDefinitions: false });

        assert.ok(list.includes(path.join(directory, 'required.d.ts')));
        assert.ok(!list.includes(path.join(directory, 'required.js')));
      });
    });

    describe('and it is set to true', () => {
      it('resolves TypeScript imports to their JavaScript implementation files', () => {
        const directory = path.join(__dirname, 'fixtures', 'noTypeDefinitions');
        const filename = path.join(directory, 'entrypoint.ts');

        const list = dependencyTree.toList({ filename, directory, noTypeDefinitions: true });

        assert.ok(list.includes(path.join(directory, 'required.js')));
        assert.ok(!list.includes(path.join(directory, 'required.d.ts')));
      });
    });
  });

  describe('Config', () => {
    describe('when given a path to a typescript config', () => {
      it('pre-parses the config for performance', () => {
        const directory = path.join(__dirname, 'fixtures/ts');
        const tsConfigPath = path.join(directory, '.tsconfig');
        const config = new Config({
          filename: 'foo',
          directory: 'bar',
          tsConfig: tsConfigPath
        });

        assert.equal(typeof config.tsConfig, 'object');
      });

      it('includes the tsConfigPath so filing-cabinet can still resolve compilerOptions.paths correctly', () => {
        const directory = path.join(__dirname, 'fixtures/ts');
        const tsConfigPath = path.join(directory, '.tsconfig');
        const config = new Config({
          filename: 'foo',
          directory: 'bar',
          tsConfig: tsConfigPath
        });

        assert.equal(config.tsConfigPath, tsConfigPath);
      });
    });

    describe('when cloning', () => {
      describe('and a detective config was set', () => {
        it('retains the detective config in the clone', () => {
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
    });
  });
});
