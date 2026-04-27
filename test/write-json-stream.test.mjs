import { strict as assert } from 'node:assert';
import { writeJsonToStream } from '../lib/write-json-stream.js';

function collect(value) {
  const chunks = [];
  writeJsonToStream(value, {
    write: c => chunks.push(c)
  });

  return chunks.join('');
}

describe('writeJsonToStream', () => {
  it('produces output identical to JSON.stringify', () => {
    const tree = {
      'a.js': {
        'b.js': {},
        'c.js': {}
      },
      'd.js': {}
    };

    assert.equal(collect(tree), JSON.stringify(tree));
  });

  it('serializes null and other non-object values via JSON.stringify', () => {
    assert.equal(collect(null), 'null');
    assert.equal(collect(42), '42');
    assert.equal(collect('hello'), '"hello"');
  });

  it('writes multiple small chunks rather than one large string', () => {
    // For { a: { b: {} } } the call sequence is:
    //   { "a.js" : { "b.js" : { } } } <- 10 separate write calls
    // If the function called write exactly once it would be no different
    // from console.log(JSON.stringify(tree)).
    const tree = {
      'a.js': {
        'b.js': {}
      }
    };
    const chunks = [];
    writeJsonToStream(tree, {
      write: c => chunks.push(c)
    });

    assert.equal(chunks.length, 10);
    assert.equal(chunks.join(''), JSON.stringify(tree));
  });

  it('handles trees with shared object references identically to JSON.stringify', () => {
    // traverse() returns the same JS object for every file that has already
    // been visited (config.visited cache). The streaming writer must produce
    // the same output as JSON.stringify for such trees.
    const shared = {
      'dep.js': {
        'transitive.js': {}
      }
    };
    const tree = {
      'a.js': shared,
      'b.js': shared
    };

    const output = collect(tree);
    const parsed = JSON.parse(output);
    const expectedA = {
      'dep.js': {
        'transitive.js': {}
      }
    };
    const expectedB = {
      'dep.js': {
        'transitive.js': {}
      }
    };

    assert.equal(output, JSON.stringify(tree));
    assert.deepEqual(parsed['a.js'], expectedA);
    assert.deepEqual(parsed['b.js'], expectedB);
  });
});
