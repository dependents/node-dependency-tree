import { strict as assert } from 'node:assert';
import path from 'node:path';
import mockfs from 'mock-fs';
import dependencyTree from '../index.js';
import {
  fixtures,
  mockEs6,
  mockSass,
  mockStylus,
  mockLess
} from './helpers.mjs';

function testToList(format, ext = '.js') {
  it('returns a post-order list form of the dependency tree', () => {
    const directory = fixtures(format);
    const filename = path.normalize(`${directory}/a${ext}`);
    const list = dependencyTree.toList({ filename, directory });

    assert.ok(Array.isArray(list));
    assert.ok(list.length > 0);
  });
}

describe('toList', () => {
  afterEach(() => {
    mockfs.restore();
  });

  it('returns an empty list on a non-existent filename', () => {
    const directory = fixtures('imaginary');
    mockfs({
      [directory]: {}
    });

    const filename = path.normalize(`${directory}/notafile.js`);
    const list = dependencyTree.toList({ filename, directory });

    assert.ok(Array.isArray(list));
    assert.equal(list.length, 0);
  });

  it('orders the visited files by last visited', () => {
    const directory = fixtures('amd');
    const filename = path.normalize(`${directory}/a.js`);
    const list = dependencyTree.toList({ filename, directory });

    assert.equal(list.length, 3);
    assert.equal(path.normalize(list[0]), path.normalize(`${directory}/c.js`));
    assert.equal(path.normalize(list[1]), path.normalize(`${directory}/b.js`));
    assert.equal(list.at(-1), filename);
  });

  it('does not throw when the dependency graph exceeds the V8 argument spread limit', () => {
    // The original code stored each file's full transitive closure in config.visited and then
    // wrote: config.visited[filename].push(...subTree)
    // V8 imposes a maximum argument count on function calls. For a project with more
    // transitive dependencies than that limit (~100k–250k on modern Node), the spread throws:
    //   RangeError: Maximum call stack size exceeded
    // _getDependencies is stubbed out because parsing a 200k-require JS file with acorn
    // takes ~2s per file, making a real-files approach impractical as a unit test.
    const N = 200_000;
    const entry = path.resolve('root/entry.js');
    const leaves = Array.from({ length: N }, (_, i) => path.resolve(`root/f${i}.js`));

    mockfs({
      root: {
        'entry.js': ''
      }
    });

    const orig = dependencyTree._getDependencies;
    dependencyTree._getDependencies = config => (config.filename === entry ? leaves : []);

    let list;
    try {
      list = dependencyTree.toList({ filename: 'root/entry.js', directory: 'root' });
    } finally {
      dependencyTree._getDependencies = orig;
    }

    assert.equal(list.length, N + 1);
    assert.equal(list.at(-1), entry);
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
