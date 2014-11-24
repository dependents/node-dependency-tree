var utils = require('../');
var assert = require('assert');

describe('getTreeAsList', function() {
  describe('amd', function() {
    it('returns a list form of the dependency tree for a file', function(done) {
      var filename = __dirname + '/example/amd/a.js';
      var root = __dirname + '/example/amd';

      utils.getTreeAsList(filename, root, function(tree) {
        assert(tree instanceof Array);
        assert(tree.length === 3);
        console.log('tree: ', tree)
        done();
      });
    });
  });
});
