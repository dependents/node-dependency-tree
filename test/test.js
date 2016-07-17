import assert from 'assert';
import mockfs from 'mock-fs';
import includes from 'array-includes';
import sinon from 'sinon';

import DependencyTree from '../';
import Module from '../lib/Module';

describe('DependencyTree', function() {
  afterEach(function() {
    mockfs.restore();
  });

  it('does not throw when initialized with no arguments', function() {
    assert.doesNotThrow(() => {
      new DependencyTree();
    });
  });

  it('throws if given a filter value that is not a function', function() {
    assert.throws(() => {
      new DependencyTree({
        filter: 'foo',
      });
    }, Error, 'filter must be a function');
  });

  describe('#traverse', function() {
    before(function() {
      this._directory =  __dirname + '/example/es6';

      mockfs({
        [this._directory]: {
          'a.js': `
            import b from './b';
            import c from './c';
          `,
          'b.js': 'import d from "./d"; export default 1;',
          'c.js': 'import d from "./d"; export default 1;',
          'd.js': 'import e from "./subdir/e"; export default 1;',
          subdir: {
            'e.js': 'export default 2;'
          }
        }
      });

      this._dependencyTree = new DependencyTree({
        directory: this._directory
      });

      this._dependencyTree.traverse(`${this._directory}/a.js`);
    });

    it('registers all visited modules', function() {
      assert.ok(this._dependencyTree.getModule(`${this._directory}/a.js`) instanceof Module);
      assert.ok(this._dependencyTree.getModule(`${this._directory}/b.js`) instanceof Module);
      assert.ok(this._dependencyTree.getModule(`${this._directory}/c.js`) instanceof Module);
      assert.ok(this._dependencyTree.getModule(`${this._directory}/d.js`) instanceof Module);
      assert.ok(this._dependencyTree.getModule(`${this._directory}/subdir/e.js`) instanceof Module);
    });

    it('provides the parsed ASTs for every visited module', function() {
      assert.ok(this._dependencyTree.getModule(`${this._directory}/a.js`).ast);
      assert.ok(this._dependencyTree.getModule(`${this._directory}/b.js`).ast);
      assert.ok(this._dependencyTree.getModule(`${this._directory}/c.js`).ast);
      assert.ok(this._dependencyTree.getModule(`${this._directory}/d.js`).ast);
      assert.ok(this._dependencyTree.getModule(`${this._directory}/subdir/e.js`).ast);
    });

    it('registers the dependencies for the file', function() {
      const {dependencies} = this._dependencyTree.getModule(`${this._directory}/a.js`);

      assert.ok(includes(dependencies, this._dependencyTree.getModule(`${this._directory}/b.js`)));
      assert.ok(includes(dependencies, this._dependencyTree.getModule(`${this._directory}/c.js`)));
    });

    it('registers dependencies within subdirectories', function() {
      const {dependencies} = this._dependencyTree.getModule(`${this._directory}/d.js`);
      assert.ok(includes(dependencies, this._dependencyTree.getModule(`${this._directory}/subdir/e.js`)));
    });

    it('registers the dependents for the dependencies of the file', function() {
      const {dependents} = this._dependencyTree.getModule(`${this._directory}/b.js`);

      assert.ok(includes(dependents, this._dependencyTree.getModule(`${this._directory}/a.js`)));
    });

    it('handles dependents within the parent directory', function() {
      const {dependents} = this._dependencyTree.getModule(`${this._directory}/subdir/e.js`);

      assert.ok(includes(dependents, this._dependencyTree.getModule(`${this._directory}/d.js`)));
    });

    it('can handle multiple dependents for a module', function() {
      const {dependents} = this._dependencyTree.getModule(`${this._directory}/d.js`);

      assert.ok(includes(dependents, this._dependencyTree.getModule(`${this._directory}/b.js`)));
      assert.ok(includes(dependents, this._dependencyTree.getModule(`${this._directory}/c.js`)));
    });
  });

  describe('#generate', function() {
    beforeEach(function() {
      this._directory =  __dirname + '/example/es6';

      mockfs({
        [this._directory]: {
          'a.js': `
            import b from './b';
            import c from './c';
          `,
          'b.js': 'import d from "./d"; export default 1;',
          'c.js': 'import d from "./d"; export default 1;',
          'd.js': 'import e from "./subdir/e"; export default 1;',
          'e.js': 'import foo from "foo";',
          subdir: {
            'e.js': 'export default 2;'
          },
          'node_modules': {
            foo: {
              'index.js': 'export default 1;',
              'package.json': `{
                "main": "index.js"
              }`
            }
          }
        }
      });
    });

    describe('when given a file', function() {
      beforeEach(function() {
        this._file = `${this._directory}/a.js`;
      });

      describe('with no specified directory, ', function() {
        it('throws an error', function() {
          this._dependencyTree = new DependencyTree();

          assert.throws(() => {
            this._dependencyTree.generate(this._file);
          }, Error, 'To generate a tree for a file, you need to supply a directory as configuration');
        });
      });

      describe('within a specified directory', function() {
        it('generates the tree for that file', function() {
          this._dependencyTree = new DependencyTree({
            directory: this._directory
          });

          const stub = sinon.stub(this._dependencyTree, 'traverse');

          this._dependencyTree.generate(this._file);
          assert.ok(stub.called);

          stub.restore();
        });
      });
    });

    describe('when given a directory', function() {
      beforeEach(function() {
        this._dependencyTree = new DependencyTree({
          directory: this._directory
        });

        this._traverse = sinon.stub(this._dependencyTree, 'traverse');

        this._dependencyTree.generate(this._directory);
      });

      afterEach(function() {
        this._traverse.restore();
      });

      it('traverses all non-excluded files in the directory', function() {
        assert.ok(this._traverse.calledWith(`${this._directory}/a.js`));
        assert.ok(this._traverse.calledWith(`${this._directory}/b.js`));
        assert.ok(this._traverse.calledWith(`${this._directory}/c.js`));
        assert.ok(this._traverse.calledWith(`${this._directory}/d.js`));
        assert.ok(this._traverse.calledWith(`${this._directory}/e.js`));
        assert.ok(this._traverse.calledWith(`${this._directory}/subdir/e.js`));
      });

      it('does not traverse excluded files', function() {
        assert.ok(!this._traverse.calledWith(`${this._directory}/node_modules/foo/index.js`));
      });
    });

    describe('when a module depends on a file in node_modules', function() {
      it('still includes the node_modules file in the generated tree', function() {
        this._dependencyTree = new DependencyTree({
          directory: this._directory
        });

        this._dependencyTree.generate(this._directory);
        assert.ok(this._dependencyTree.getModule(`${this._directory}/node_modules/foo/index.js`));
      });
    });

    describe('when given additional excludes', function() {
      it.skip('does not traverse files in those directories', function() {
        this._dependencyTree = new DependencyTree({
          directory: this._directory,
          // exclude: [
          //   'subdir/**/*.js'
          // ]
        });

        this._dependencyTree.generate(this._directory);

        assert.equal(this._dependencyTree.getModule(`${this._directory}/subdir/e.js`), undefined);
      });
    });
  });
});
