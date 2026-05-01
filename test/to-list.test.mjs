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

    assert.equal(Array.isArray(list), true);
    assert.notEqual(list.length, 0);
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

    assert.equal(Array.isArray(list), true);
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
