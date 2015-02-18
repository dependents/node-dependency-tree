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
      assert(tree.root);
      assert(tree.nodes instanceof Object);
      assert(tree.nodes[tree.root] instanceof Array);
      assert(tree.nodes[tree.root].length === 2);
    });
  }

  it('does not include files that are not real (#13)', function() {
    var root = __dirname + '/example/onlyRealDeps';
    var filename = root + '/a.js';

    var tree = dependencyTree(filename, root);
    assert(tree.nodes[tree.root].length === 0);
    assert(tree.root.indexOf('a.js') !== -1);
  });

  it('does not choke on cyclic dependencies', function() {
    var root = __dirname + '/example/cyclic';
    var filename = root + '/a.js';

    var spy = sinon.spy(dependencyTree, '_getDependencies');

    var tree = dependencyTree(filename, root);
    assert(spy.callCount === 2);
    assert(tree.nodes[tree.root].length);
    dependencyTree._getDependencies.restore();
  });

  it('excludes Node core modules by default', function() {
    var root = __dirname + '/example/commonjs';
    var filename = root + '/b.js';

    var tree = dependencyTree(filename, root);
    assert(tree.nodes[tree.root].length === 0);
    assert(tree.root.indexOf('b.js') !== -1);
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
      assert(tree.nodes[tree.root].length === 2);
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

  describe('traversePreOrder', function() {
    var root = __dirname + '/example/amd';
    var filename = root + '/a.js';

    function testTraversePreOrder(format, ext) {
      ext = ext || '.js';

      it('returns a pre-order list form of the dependency tree', function() {
        var root = __dirname + '/example/' + format;
        var filename = root + '/a' + ext;

        var tree = dependencyTree(filename, root);
        var list = dependencyTree.traversePreOrder(tree);
        assert(list instanceof Array);
        assert(list.length === 3);
        assert(list[0] === tree.root);
        assert(list[1] === tree.nodes[tree.root][0]);
        assert(list[2] === tree.nodes[tree.root][1]);
      });
    }

    describe('throws', function() {
      it('throws if tree is undefined', function() {
        assert.throws(function() {
          var tree;
          dependencyTree.traversePostOrder(tree);
        }, /tree not given/);
      });

      it('throws if tree.root is undefined', function() {
        assert.throws(function() {
          var tree = {};
          dependencyTree.traversePostOrder(tree);
        }, /Tree object is missing root/);
      });

      it('throws if tree.nodes is undefined', function() {
        assert.throws(function() {
          var tree = {root: 'a.js'};
          dependencyTree.traversePostOrder(tree);
        }, /Tree object is missing nodes/);
      });
    });

    describe('module formats', function() {
      describe('amd', function() {
        testTraversePreOrder('amd');
      });

      describe('commonjs', function() {
        testTraversePreOrder('commonjs');
      });

      describe('es6', function() {
        testTraversePreOrder('es6');
      });

      describe('sass', function() {
        testTraversePreOrder('sass', '.scss');
      });
    });
  });

  describe('traversePostOrder', function() {
    var root = __dirname + '/example/amd';
    var filename = root + '/a.js';

    function testTraversePostOrder(format, ext) {
      ext = ext || '.js';

      it('returns a post-order list form of the dependency tree', function() {
        var root = __dirname + '/example/' + format;
        var filename = root + '/a' + ext;

        var tree = dependencyTree(filename, root);
        var list = dependencyTree.traversePostOrder(tree);
        assert(list instanceof Array);
        assert(list.length === 3);
        assert(list[0] === tree.nodes[tree.root][0]);
        assert(list[1] === tree.nodes[tree.root][1]);
        assert(list[2] === tree.root);
      });
    }

    describe('throws', function() {
      it('throws if tree is undefined', function() {
        assert.throws(function() {
          var tree;
          dependencyTree.traversePostOrder(tree);
        }, /tree not given/);
      });

      it('throws if tree.root is undefined', function() {
        assert.throws(function() {
          var tree = {};
          dependencyTree.traversePostOrder(tree);
        }, /Tree object is missing root/);
      });

      it('throws if tree.nodes is undefined', function() {
        assert.throws(function() {
          var tree = {root: 'a.js'};
          dependencyTree.traversePostOrder(tree);
        }, /Tree object is missing nodes/);
      });
    });

    describe('module formats', function() {
      describe('amd', function() {
        testTraversePostOrder('amd');
      });

      describe('commonjs', function() {
        testTraversePostOrder('commonjs');
      });

      describe('es6', function() {
        testTraversePostOrder('es6');
      });

      describe('sass', function() {
        testTraversePostOrder('sass', '.scss');
      });
    });
  });
});
