'use strict';

/**
 * Writes value as JSON directly to stream, chunk by chunk, without first
 * serializing the whole tree into a single string.
 *
 * JSON.stringify buffers its entire output as one JavaScript string before
 * writing anything. For large dependency trees (e.g. nx monorepos) that
 * string can exceed V8's string-length limit and crash with
 * "RangeError: Invalid string length". Writing incrementally avoids that
 * limit entirely - each chunk is a small string, never the full tree.
 *
 * Output is identical to JSON.stringify for any object tree.
 *
 * @param {unknown} value
 * @param {import('node:stream').Writable} stream
 */
function writeJsonToStream(value, stream) {
  if (value === null || typeof value !== 'object') {
    stream.write(JSON.stringify(value));
    return;
  }

  stream.write('{');

  let first = true;

  for (const [key, val] of Object.entries(value)) {
    if (!first) stream.write(',');

    first = false;
    stream.write(JSON.stringify(key));
    stream.write(':');
    writeJsonToStream(val, stream);
  }

  stream.write('}');
}

module.exports = { writeJsonToStream };
