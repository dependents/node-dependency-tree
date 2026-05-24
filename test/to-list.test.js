import path from 'node:path';
import mockfs from 'mock-fs';
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach
} from 'vitest';
import dependencyTree from '../index.js';
import {
  fixtures,
  mockEs6,
  mockSass,
  mockStylus,
  mockLess
} from './helpers.js';

function testToList(format, ext = '.js') {
  it('returns a post-order list form of the dependency tree', () => {
    const directory = fixtures(format);
    const filename = path.normalize(`${directory}/a${ext}`);
    const list = dependencyTree.toList({ filename, directory });

    expect(list).toBeInstanceOf(Array);
    expect(list.length).toBeGreaterThan(0);
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

    expect(list).toStrictEqual([]);
  });

  it('orders the visited files by last visited', () => {
    const directory = fixtures('amd');
    const filename = path.normalize(`${directory}/a.js`);
    const list = dependencyTree.toList({ filename, directory });

    expect(list.map(p => path.normalize(p))).toStrictEqual([
      path.normalize(`${directory}/c.js`),
      path.normalize(`${directory}/b.js`),
      filename
    ]);
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
