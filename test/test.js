var getTreeAsList = require('../');
var assert = require('assert');
var sinon = require('sinon');

describe('getTreeAsList', function() {
  var root = __dirname + '/example/amd';
  var filename = root + '/a.js';

  function testTreesForFormat(format, ext) {
    ext = ext || '.js';

    it('returns a list form of the dependency tree for a file', function() {
      var root = __dirname + '/example/' + format;
      var filename = root + '/a' + ext;

      var tree = getTreeAsList(filename, root)
      assert(tree instanceof Array);
      assert(tree.length === 3);
    });
  }

  it('does not include files that are not real (#13)', function() {
    var root = __dirname + '/example/onlyRealDeps';
    var filename = root + '/a.js';

    var tree = getTreeAsList(filename, root);
    assert(tree.length === 1);
    assert(tree[0].indexOf('a.js') !== -1);
  });

  it('does not choke on cyclic dependencies', function() {
    var root = __dirname + '/example/cyclic';
    var filename = root + '/a.js';

    var spy = sinon.spy(getTreeAsList, '_getDependencies');

    var tree = getTreeAsList(filename, root);
    assert(spy.callCount === 2);
    assert(tree.length);
    getTreeAsList._getDependencies.restore();
  });

  it('excludes Node core modules by default', function() {
    var root = __dirname + '/example/commonjs';
    var filename = root + '/b.js';

    var tree = getTreeAsList(filename, root);
    assert(tree.length === 1);
    assert(tree[0].indexOf('b.js') !== -1);
  });

  it('returns a list of absolutely pathed files', function() {
    var root = __dirname + '/example/commonjs';
    var filename = root + '/b.js';

    var tree = getTreeAsList(filename, root);
    assert(tree[0].indexOf(process.cwd()) !== -1);
  });

  describe('throws', function() {
    it('throws if the filename is missing', function() {
      assert.throws(function() {
        getTreeAsList(undefined, root);
      });
    });

    it('throws if the root is missing', function() {
      assert.throws(function() {
        getTreeAsList(filename);
      });
    });
  });

  describe('on file error', function() {
    it('does not throw', function() {
      assert.doesNotThrow(function() {
        getTreeAsList('foo', root);
      });
    });

    it('returns no dependencies', function() {
      var tree = getTreeAsList('foo', root);
      assert(!tree.length);
    });
  });

  describe('memoization (#2)', function() {
    var spy;

    beforeEach(function() {
      spy = sinon.spy(getTreeAsList, '_getDependencies');
    });

    afterEach(function() {
      getTreeAsList._getDependencies.restore();
    });

    it('accepts an optional cache object for memoization (#2)', function() {
      var filename = __dirname + '/example/amd/a.js';
      var root = __dirname + '/example/amd';
      var cache = {};

      cache[__dirname + '/example/amd/b.js'] = [
        __dirname + '/example/amd/b.js',
        __dirname + '/example/amd/c.js'
      ];

      var tree = getTreeAsList(filename, root, cache);
      assert(tree.length === 3);
      assert(spy.neverCalledWith(__dirname + '/example/amd/b.js'));
    });

    it('returns the precomputed list of a cached entry point', function() {
      var filename = __dirname + '/example/amd/a.js';
      var root = __dirname + '/example/amd';

      var cache = {};
      // Shouldn't process the first file's tree
      cache[filename] = [];

      var tree = getTreeAsList(filename, root, cache);
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
      testTreesForFormat('es6');
    });

    describe('sass', function() {
      testTreesForFormat('sass', '.scss');
    });
  });
});
