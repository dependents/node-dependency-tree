'use strict';

/**
 * Writes value as JSON directly to stream, chunk by chunk, without first
 * serializing the whole tree into a single string.
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
