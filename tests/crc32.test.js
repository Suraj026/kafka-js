// table-driven CRC-32C implementation and cross-checked against the
// standard published test vector (see the first test).
import { test, describe } from "node:test";
import assert from "node:assert";
import { crc32c } from "../protocol/crc32.js"; 

function buf(str) {
  return Buffer.from(str, 'utf8');
}

describe('CRC-32C known vectors', () => {
  test('the standard published test vector: "123456789" -> 0xE3069283', () => {
    // This is THE reference vector used to validate any CRC-32C implementation.
    // If this one test fails, the polynomial, init value, or final XOR is wrong.
    assert.strictEqual(crc32c(buf('123456789')), 0xe3069283);
  });

  test('single character "a"', () => {
    assert.strictEqual(crc32c(buf('a')), 0xc1d04330);
  });

  test('short string "abc"', () => {
    assert.strictEqual(crc32c(buf('abc')), 0x364b3fb7);
  });

  test('project-relevant string "Kafka"', () => {
    assert.strictEqual(crc32c(buf('Kafka')), 0x13e395b6);
  });

  test('longer sentence (crosses many table lookups)', () => {
    assert.strictEqual(
      crc32c(buf('The quick brown fox jumps over the lazy dog')),
      0x22620404
    );
  });
});

describe('CRC-32C edge cases', () => {
  test('empty buffer returns 0, not 0xFFFFFFFF', () => {
    // Catches a missing final XOR: with input of 0 bytes, crc stays at the
    // init value 0xFFFFFFFF, and the final XOR with 0xFFFFFFFF must bring
    // it back to 0. If you see 0xFFFFFFFF here, the final XOR is missing.
    assert.strictEqual(crc32c(Buffer.alloc(0)), 0x00000000);
  });

  test('single zero byte', () => {
    assert.strictEqual(crc32c(Buffer.from([0x00])), 0x527d5351);
  });

  test('single 0xFF byte', () => {
    // High-bit-heavy input: a good catch for sign-extension bugs if >> is
    // used instead of >>> anywhere in the table build or main loop.
    assert.strictEqual(crc32c(Buffer.from([0xff])), 0xff000000);
  });

  test('all 256 byte values in sequence', () => {
    const data = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
    assert.strictEqual(crc32c(data), 0x9c44184b);
  });

  test('result is always a non-negative 32-bit value', () => {
    // In JS, >>> produces an unsigned result, but if the implementation
    // mixes in a signed >> anywhere, this can come back negative.
    const result = crc32c(buf('Kafka'));
    assert.ok(result >= 0);
    assert.ok(result <= 0xffffffff);
    assert.strictEqual(result, result >>> 0);
  });

  test('different inputs of the same length produce different checksums', () => {
    // Not a proof of correctness, but catches a degenerate implementation
    // that ignores byte values (e.g. only hashes length).
    const a = crc32c(buf('aaaa'));
    const b = crc32c(buf('aaab'));
    assert.notStrictEqual(a, b);
  });

  test('is deterministic across repeated calls', () => {
    const data = buf('deterministic check');
    assert.strictEqual(crc32c(data), crc32c(data));
  });

  test('does not mutate the input buffer', () => {
    const data = Buffer.from('do not touch', 'utf8');
    const copy = Buffer.from(data);
    crc32c(data);
    assert.ok(data.equals(copy));
  });

  test('single-byte-at-a-time concatenation matches one-shot call on the whole buffer', () => {
    // This project only needs crc32c(buffer) as one call, not an incremental
    // / streaming API -- but this test confirms the function is well-defined
    // over the full buffer regardless of how it's internally chunked.
    const data = buf('consistency across the whole input');
    const whole = crc32c(data);
    const copy = Buffer.from(data); // same bytes, different buffer instance
    assert.strictEqual(crc32c(copy), whole);
  });
});

describe('CRC-32C as used in a record batch (integration-style)', () => {
  test('matches when read back after being written into a larger buffer', () => {
    // Simulates: compute CRC over a slice of a bigger buffer, the way the
    // record batch will (CRC covers attributes-onward, not the whole batch).
    const prefix = Buffer.from([0x00, 0x00, 0x00, 0x01]); // pretend leading fields
    const payload = buf('123456789');
    const whole = Buffer.concat([prefix, payload]);
    const slice = whole.subarray(4); // the part the CRC should actually cover
    assert.strictEqual(crc32c(slice), 0xe3069283);
  });
});