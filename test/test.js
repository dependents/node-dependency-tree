var dependencyTree = require('../');
var assert = require('assert');
var sinon = require('sinon');

describe('dependencyTree', function() {
  var root = __dirname + '/example/amd';
  var filename = root + '/a.js';

  function testTreesForFormat(format, ext) {
    ext = ext || '.js';

    it('returns an object form of the dependency tree for a file', function() {
      var root = __dirname + '/example/' + format;
      var filename = root + '/a' + ext;

      var tree = dependencyTree(filename, root);
      assert(tree instanceof Object);
      var subTree = tree[filename];
      assert(subTree instanceof Object);
      assert.equal(Object.keys(subTree).length, 2);
    });
  }

  it('returns an empty object for a non-existent filename', function() {
    var root = __dirname + '/example/extended';
    var filename = root + '/notafile.js';
    var tree = dependencyTree(filename, root);
    assert(tree instanceof Object);
    assert(!Object.keys(tree).length);
  });

  it('handles nested tree structures', function() {
    var root = __dirname + '/example/extended';
    var filename = root + '/a.js';

    var tree = dependencyTree(filename, root);
    assert(tree[filename] instanceof Object);
    // b and c
    var subTree = tree[filename];
    assert.equal(Object.keys(subTree).length, 2);
    var bTree = subTree[root + '/b.js'];
    var cTree = subTree[root + '/c.js'];
    // d and e
    assert.equal(Object.keys(bTree).length, 2);
    // f ang g
    assert.equal(Object.keys(cTree).length, 2);
  });

  it('does not include files that are not real (#13)', function() {
    var root = __dirname + '/example/onlyRealDeps';
    var filename = root + '/a.js';

    var tree = dependencyTree(filename, root);
    var subTree = tree[filename];

    assert(Object.keys(subTree).length === 0);
    assert(Object.keys(tree)[0].indexOf('a.js') !== -1);
  });

  it('does not choke on cyclic dependencies', function() {
    var root = __dirname + '/example/cyclic';
    var filename = root + '/a.js';

    var spy = sinon.spy(dependencyTree, '_getDependencies');

    var tree = dependencyTree(filename, root);

    assert(spy.callCount === 2);
    assert(Object.keys(tree[filename]).length);
    dependencyTree._getDependencies.restore();
  });

  it('excludes Nodejs core modules by default', function() {
    var root = __dirname + '/example/commonjs';
    var filename = root + '/b.js';

    var tree = dependencyTree(filename, root);
    assert(Object.keys(tree[filename]).length === 0);
    assert(Object.keys(tree)[0].indexOf('b.js') !== -1);
  });

  it('returns a list of absolutely pathed files', function() {
    var root = __dirname + '/example/commonjs';
    var filename = root + '/b.js';

    var tree = dependencyTree(filename, root);
    for (var node in tree.nodes) {
      assert(node.indexOf(process.cwd()) !== -1);
    }
  });

  describe('throws', function() {
    it('throws if the filename is missing', function() {
      assert.throws(function() {
        dependencyTree(undefined, root);
      });
    });

    it('throws if the root is missing', function() {
      assert.throws(function() {
        dependencyTree(filename);
      });
    });
  });

  describe('on file error', function() {
    it('does not throw', function() {
      assert.doesNotThrow(function() {
        dependencyTree('foo', root);
      });
    });

    it('returns no dependencies', function() {
      var tree = dependencyTree('foo', root);
      assert(!tree.length);
    });
  });

  describe('memoization (#2)', function() {
    var spy;

    beforeEach(function() {
      spy = sinon.spy(dependencyTree, '_getDependencies');
    });

    afterEach(function() {
      dependencyTree._getDependencies.restore();
    });

    it('accepts an optional cache object for memoization (#2)', function() {
      var filename = __dirname + '/example/amd/a.js';
      var root = __dirname + '/example/amd';
      var cache = {};

      cache[__dirname + '/example/amd/b.js'] = [
        __dirname + '/example/amd/b.js',
        __dirname + '/example/amd/c.js'
      ];

      var tree = dependencyTree(filename, root, cache);
      assert.equal(Object.keys(tree[filename]).length, 2);
      assert(spy.neverCalledWith(__dirname + '/example/amd/b.js'));
    });

    it('returns the precomputed list of a cached entry point', function() {
      var filename = __dirname + '/example/amd/a.js';
      var root = __dirname + '/example/amd';

      var cache = {};
      // Shouldn't process the first file's tree
      cache[filename] = [];

      var tree = dependencyTree(filename, root, cache);
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

  describe('toList', function() {
    var root = __dirname + '/example/amd';
    var filename = root + '/a.js';

    function testToList(format, ext) {
      ext = ext || '.js';

      it('returns a post-order list form of the dependency tree', function() {
        var root = __dirname + '/example/' + format;
        var filename = root + '/a' + ext;

        var list = dependencyTree.toList(filename, root);
        assert(list instanceof Array);
        assert(list.length);
      });
    }

    it('returns an empty list on a non-existent filename', function() {
      var root = __dirname + '/example/extended';
      var filename = root + '/notafile.js';
      var list = dependencyTree.toList(filename, root);
      assert(list instanceof Array);
      assert(!list.length);
    });

    it('orders the visited files by last visited', function() {
      var root = __dirname + '/example/amd';
      var filename = root + '/a.js';
      var list = dependencyTree.toList(filename, root);

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
        testToList('es6');
      });

      describe('sass', function() {
        testToList('sass', '.scss');
      });
    });
  });
});
