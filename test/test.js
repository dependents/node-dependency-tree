import dependencyTree from '../';
import assert from 'assert';
import sinon from 'sinon';
import mockfs from 'mock-fs';
import path from 'path';

describe('dependencyTree', function() {
  function testTreesForFormat(format, ext = '.js') {
    it('returns an object form of the dependency tree for a file', function() {
      const root = __dirname + '/example/' + format;
      const filename = root + '/a' + ext;

      const tree = dependencyTree({filename, root});

      assert(tree instanceof Object);

      const subTree = tree[filename];

      assert(subTree instanceof Object);
      assert.equal(Object.keys(subTree).length, 2);
    });
  }

  function mockStylus() {
    mockfs({
      [__dirname + '/example/stylus']: {
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
      [__dirname + '/example/sass']: {
        'a.scss': `
          @import "_b";
          @import "_c.scss";
        `,
        '_b.scss': 'body { color: blue; }',
        '_c.scss': 'body { color: pink; }'
      }
    });
  }

  function mockes6() {
    mockfs({
      [__dirname + '/example/es6']: {
        'a.js': `
          import b from './b';
          import c from './c';
        `,
        'b.js': 'export default function() {};',
        'c.js': 'export default function() {};'
      }
    });
  }

  afterEach(function() {
    mockfs.restore();
  });

  it('returns an empty object for a non-existent filename', function() {
    mockfs({
      imaginary: {}
    });

    const root = __dirname + '/imaginary';
    const filename = root + '/notafile.js';
    const tree = dependencyTree({filename, root});

    assert(tree instanceof Object);
    assert(!Object.keys(tree).length);
  });

  it('handles nested tree structures', function() {
    mockfs({
      [__dirname + '/extended']: {
        'a.js': `var b = require('./b');
                 var c = require('./c');`,
        'b.js': `var d = require('./d');
                 var e = require('./e');`,
        'c.js': `var f = require('./f');
                 var g = require('./g');`,
        'd.js': '',
        'e.js': '',
        'f.js': '',
        'g.js': ''
      }
    });

    const root = __dirname + '/extended';
    const filename = root + '/a.js';

    const tree = dependencyTree({filename, root});

    assert(tree[filename] instanceof Object);

    // b and c
    const subTree = tree[filename];
    assert.equal(Object.keys(subTree).length, 2);

    const bTree = subTree[root + '/b.js'];
    const cTree = subTree[root + '/c.js'];
    // d and e
    assert.equal(Object.keys(bTree).length, 2);
    // f ang g
    assert.equal(Object.keys(cTree).length, 2);
  });

  it('does not include files that are not real (#13)', function() {
    mockfs({
      [__dirname + '/onlyRealDeps']: {
        'a.js': 'var notReal = require("./notReal");'
      }
    });

    const root = __dirname + '/onlyRealDeps';
    const filename = root + '/a.js';

    const tree = dependencyTree({filename, root});
    const subTree = tree[filename];

    assert.ok(!Object.keys(subTree).some(dep => dep.indexOf('notReal') !== -1));
  });

  it('does not choke on cyclic dependencies', function() {
    mockfs({
      [__dirname + '/cyclic']: {
        'a.js': 'var b = require("./b");',
        'b.js': 'var a = require("./a");'
      }
    });

    const root = __dirname + '/cyclic';
    const filename = root + '/a.js';

    const spy = sinon.spy(dependencyTree, '_getDependencies');

    const tree = dependencyTree({filename, root});

    assert(spy.callCount === 2);
    assert(Object.keys(tree[filename]).length);

    dependencyTree._getDependencies.restore();
  });

  it('excludes Nodejs core modules by default', function() {
    const root = __dirname + '/example/commonjs';
    const filename = root + '/b.js';

    const tree = dependencyTree({filename, root});
    assert(Object.keys(tree[filename]).length === 0);
    assert(Object.keys(tree)[0].indexOf('b.js') !== -1);
  });

  it('traverses installed 3rd party node modules', function() {
    const root = __dirname + '/example/onlyRealDeps';
    const filename = root + '/a.js';

    const tree = dependencyTree({filename, root});
    const subTree = tree[filename];

    assert(Object.keys(subTree).some(dep => dep === require.resolve('debug')));
  });

  it('returns a list of absolutely pathed files', function() {
    const root = __dirname + '/example/commonjs';
    const filename = root + '/b.js';

    const tree = dependencyTree({filename, root});

    for (let node in tree.nodes) {
      assert(node.indexOf(process.cwd()) !== -1);
    }
  });

  it('excludes duplicate modules from the tree', function() {
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
      root: 'root'
    });

    assert(tree.length === 3);
  });

  describe('throws', function() {
    it('throws if the filename is missing', function() {
      assert.throws(function() {
        dependencyTree({filename: undefined, root});
      });
    });

    it('throws if the root is missing', function() {
      assert.throws(function() {
        dependencyTree({filename});
      });
    });
  });

  describe('on file error', function() {
    it('does not throw', function() {
      assert.doesNotThrow(function() {
        dependencyTree({filename: 'foo', root});
      });
    });

    it('returns no dependencies', function() {
      const tree = dependencyTree({filename: 'foo', root});
      assert(!tree.length);
    });
  });

  describe('memoization (#2)', function() {
    beforeEach(function() {
      this._spy = sinon.spy(dependencyTree, '_getDependencies');
    });

    afterEach(function() {
      dependencyTree._getDependencies.restore();
    });

    it('accepts a cache object for memoization (#2)', function() {
      const filename = __dirname + '/example/amd/a.js';
      const root = __dirname + '/example/amd';
      const cache = {};

      cache[__dirname + '/example/amd/b.js'] = [
        __dirname + '/example/amd/b.js',
        __dirname + '/example/amd/c.js'
      ];

      const tree = dependencyTree({
        filename,
        root,
        visited: cache
      });

      assert.equal(Object.keys(tree[filename]).length, 2);
      assert(this._spy.neverCalledWith(__dirname + '/example/amd/b.js'));
    });

    it('returns the precomputed list of a cached entry point', function() {
      const filename = __dirname + '/example/amd/a.js';
      const root = __dirname + '/example/amd';

      const cache = {
        // Shouldn't process the first file's tree
        [filename]: []
      };

      const tree = dependencyTree({
        filename,
        root,
        visited: cache
      });

      assert(!tree.length);
    });
  });

  describe('module formats', function() {
    describe('amd', function() {
      testTreesForFormat('amd');
    });

    describe('commonjs', function() {
      testTreesForFormat('commonjs');
    });

    describe('es6', function() {
      beforeEach(function() {
        mockes6();
      });

      testTreesForFormat('es6');
    });

    describe('sass', function() {
      beforeEach(function() {
        mockSass();
      });

      testTreesForFormat('sass', '.scss');
    });

    describe('stylus', function() {
      beforeEach(function() {
        mockStylus();
      });

      testTreesForFormat('stylus', '.styl');
    });
  });

  describe('toList', function() {
    function testToList(format, ext = '.js') {
      it('returns a post-order list form of the dependency tree', function() {
        const root = __dirname + '/example/' + format;
        const filename = root + '/a' + ext;

        const list = dependencyTree.toList({
          filename,
          root
        });

        assert(list instanceof Array);
        assert(list.length);
      });
    }

    it('returns an empty list on a non-existent filename', function() {
      mockfs({
        imaginary: {}
      });

      const root = __dirname + '/imaginary';
      const filename = root + '/notafile.js';

      const list = dependencyTree.toList({
        filename,
        root
      });

      assert(list instanceof Array);
      assert(!list.length);
    });

    it('orders the visited files by last visited', function() {
      const root = __dirname + '/example/amd';
      const filename = root + '/a.js';
      const list = dependencyTree.toList({
        filename,
        root
      });

      assert(list.length === 3);
      assert(list[0] === root + '/c.js');
      assert(list[1] === root + '/b.js');
      assert(list[list.length - 1] === filename);
    });

    describe('module formats', function() {
      describe('amd', function() {
        testToList('amd');
      });

      describe('commonjs', function() {
        testToList('commonjs');
      });

      describe('es6', function() {
        beforeEach(function() {
          mockes6();
        });

        testToList('es6');
      });

      describe('sass', function() {
        beforeEach(function() {
          mockSass();
        });

        testToList('sass', '.scss');
      });

      describe('stylus', function() {
        beforeEach(function() {
          mockStylus();
        });

        testToList('stylus', '.styl');
      });
    });
  });

  describe('webpack', function() {
    beforeEach(function() {
      // Note: not mocking because webpack's resolver needs a real project with dependencies;
      // otherwise, we'd have to mock a ton of files.
      this._root = path.join(__dirname, '../');
      this._webpackConfig = this._root + '/webpack.config.js';

      this._testResolution = name => {
        const results = dependencyTree.toList({
          filename: `${__dirname}/example/webpack/${name}.js`,
          root: this._root,
          webpackConfig: this._webpackConfig
        });

        assert.ok(results.some(filename => filename.indexOf('node_modules/filing-cabinet') !== -1));
      };
    });

    it('resolves aliased modules', function() {
      this._testResolution('aliased');
    });

    it('resolves unaliased modules', function() {
      this._testResolution('unaliased');
    });
  });

  describe('requirejs', function() {
    beforeEach(function() {
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

    it('resolves aliased modules', function() {
      const tree = dependencyTree({
        filename: 'root/a.js',
        root: 'root',
        config: 'root/require.config.js'
      });

      const filename = path.resolve(process.cwd(), 'root/a.js');
      const aliasedFile = path.resolve(process.cwd(), 'root/lodizzle.js');
      assert.ok('root/lodizzle.js' in tree[filename]);
    });

    it('resolves non-aliased paths', function() {
      const tree = dependencyTree({
        filename: 'root/b.js',
        root: 'root',
        config: 'root/require.config.js'
      });

      const filename = path.resolve(process.cwd(), 'root/b.js');
      const aliasedFile = path.resolve(process.cwd(), 'root/lodizzle.js');
      assert.ok('root/lodizzle.js' in tree[filename]);
    });
  });
});
