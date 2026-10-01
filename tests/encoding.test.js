import { test, describe } from 'node:test';
import assert from 'node:assert';
import { Reader, Writer } from '../protocol/encoding.js';

// write one value with writer and read it back with writer
function roundTrip(writeMethod, readMethod, value) {
    const w = new Writer();
    w[writeMethod](value);

    const r = new Reader(w.toBuffer());
    const out = r[readMethod]();

    assert.strictEqual(r.remaining(), 0, 'Reader should consume every byte written');
    return out;
}

function hex(writeMethod, value) {
    const w = new Writer();
    w[writeMethod](value);

    return w.toBuffer().toString('hex');
}

describe('int8', () => {
    for (const v of [0, 1, -1, 127, -128]) {
        test(`round trip ${v}`, () => {
            assert.strictEqual(roundTrip('writeInt8', 'readInt8', v), v);
        });
    }
    test('wire format', () => {
        assert.strictEqual(hex('writeInt8', 1), '01');
        assert.strictEqual(hex('writeInt8', -1), 'ff');
    });
    test('rejects out-of-range value', () => {
        assert.throws(() => new Writer().writeInt8(128));
    });
});

describe('int16', () => {
    for (const v of [0, 1, -1, 258, 32767, -32768]) {
        test(`round-trips ${v}`, () => {
            assert.strictEqual(roundTrip('writeInt16', 'readInt16', v), v);
        });
    }
    test('wire format is big-endian', () => {
        assert.strictEqual(hex('writeInt16', 1), '0001');
        assert.strictEqual(hex('writeInt16', 258), '0102');
        assert.strictEqual(hex('writeInt16', -1), 'ffff');
    });
    test('rejects out-of-range value', () => {
        assert.throws(() => new Writer().writeInt16(32768));
    });
});

describe('int32', () => {
    for (const v of [0, 1, -1, 258, 2147483647, -2147483648]) {
        test(`round-trips ${v}`, () => {
            assert.strictEqual(roundTrip('writeInt32', 'readInt32', v), v);
        });
    }
    test('wire format is big-endian', () => {
        assert.strictEqual(hex('writeInt32', 1), '00000001');
        assert.strictEqual(hex('writeInt32', 258), '00000102');
        assert.strictEqual(hex('writeInt32', -1), 'ffffffff');
    });
    test('rejects out-of-range value', () => {
        assert.throws(() => new Writer().writeInt32(2147483648));
    });
});

describe('int64', () => {
    const values = [0n, 1n, -1n, BigInt(Number.MAX_SAFE_INTEGER), 2n ** 63n - 1n, -(2n ** 63n)];
    for (const v of values) {
        test(`round-trips ${v}`, () => {
            const out = roundTrip('writeInt64', 'readInt64', v);
            assert.strictEqual(typeof out, 'bigint');
            assert.strictEqual(out, v);
        });
    }
    test('wire format is big-endian', () => {
        assert.strictEqual(hex('writeInt64', 1n), '0000000000000001');
        assert.strictEqual(hex('writeInt64', -1n), 'ffffffffffffffff');
    });
});

describe('string', () => {
    for (const v of ['hello', '', 'my-client_01 !@#']) {
        test(`round-trips ${JSON.stringify(v)}`, () => {
            assert.strictEqual(roundTrip('writeString', 'readString', v), v);
        });
    }
    test('null round-trips as null, not empty string', () => {
        assert.strictEqual(roundTrip('writeString', 'readString', null), null);
    });
    test('wire format: int16 length prefix + utf8', () => {
        assert.strictEqual(hex('writeString', 'hi'), '00026869');
        assert.strictEqual(hex('writeString', ''), '0000');
        assert.strictEqual(hex('writeString', null), 'ffff');
    });
        test('rejects negative length other than -1', () => {
        // -2 encoded as int16: fffe
        const r = new Reader(Buffer.from([0xff, 0xfe]));
        assert.throws(() => r.readString(), /Invalid string length: -2/);
        
        // -100 encoded as int16: ff9c
        const r2 = new Reader(Buffer.from([0xff, 0x9c]));
        assert.throws(() => r2.readString(), /Invalid string length: -100/);
    });

});

describe('bytes', () => {
    test('round-trips a buffer', () => {
        const input = Buffer.from([1, 2, 3, 250]);
        const out = roundTrip('writeBytes', 'readBytes', input);
        assert.ok(Buffer.isBuffer(out));
        assert.ok(out.equals(input));
    });
    test('empty buffer round-trips as empty buffer, not null', () => {
        const out = roundTrip('writeBytes', 'readBytes', Buffer.alloc(0));
        assert.ok(Buffer.isBuffer(out));
        assert.strictEqual(out.length, 0);
    });
    test('rejects negative length other than -1', () => {
    // -2 encoded as int32: ff ff ff fe
    const r = new Reader(Buffer.from([0xff, 0xff, 0xff, 0xfe]));
    assert.throws(() => r.readBytes(), /Invalid bytes length: -2/);
    
    // -100 encoded as int32: ff ff ff 9c
    const r2 = new Reader(Buffer.from([0xff, 0xff, 0xff, 0x9c]));
    assert.throws(() => r2.readBytes(), /Invalid bytes length: -100/);
    });

    test('null round-trips as null', () => {
        assert.strictEqual(roundTrip('writeBytes', 'readBytes', null), null);
    });
    test('wire format: int32 length prefix + raw bytes', () => {
        assert.strictEqual(hex('writeBytes', Buffer.from([1, 2, 3])), '00000003010203');
        assert.strictEqual(hex('writeBytes', Buffer.alloc(0)), '00000000');
        assert.strictEqual(hex('writeBytes', null), 'ffffffff');
    });
});

describe('composite', () => {
    test('mixed types written in sequence read back in order', () => {
        const w = new Writer();
        w.writeInt16(3);
        w.writeInt16(0);
        w.writeInt32(42);
        w.writeString('my-client');
        w.writeString(null);
        w.writeInt64(123456789012n);
        w.writeBytes(Buffer.from('key'));
        w.writeBytes(null);
        w.writeInt8(-5);

        const r = new Reader(w.toBuffer());
        assert.strictEqual(r.readInt16(), 3);
        assert.strictEqual(r.readInt16(), 0);
        assert.strictEqual(r.readInt32(), 42);
        assert.strictEqual(r.readString(), 'my-client');
        assert.strictEqual(r.readString(), null);
        assert.strictEqual(r.readInt64(), 123456789012n);
        assert.strictEqual(r.readBytes().toString(), 'key');
        assert.strictEqual(r.readBytes(), null);
        assert.strictEqual(r.readInt8(), -5);
        assert.strictEqual(r.remaining(), 0);
    });

    test('remaining() decreases as values are read', () => {
        const w = new Writer();
        w.writeInt32(1);
        w.writeInt32(2);
        const r = new Reader(w.toBuffer());
        assert.strictEqual(r.remaining(), 8);
        r.readInt32();
        assert.strictEqual(r.remaining(), 4);
        r.readInt32();
        assert.strictEqual(r.remaining(), 0);
    });

    test('reader can start from a buffer containing trailing bytes', () => {
        const w = new Writer();
        w.writeInt32(7);
        const buf = Buffer.concat([w.toBuffer(), Buffer.from([9, 9])]);
        const r = new Reader(buf);
        assert.strictEqual(r.readInt32(), 7);
        assert.strictEqual(r.remaining(), 2);
    });
});

describe('truncated input (matters once TCP framing hands you partial data)', () => {
    test('reading an int past the end throws', () => {
        const r = new Reader(Buffer.from([0, 0]));
        assert.throws(() => r.readInt32());
    });
    test('string whose length prefix exceeds remaining bytes throws', () => {
        // claims 10 bytes, only 2 follow
        const r = new Reader(Buffer.from([0x00, 0x0a, 0x68, 0x69]));
        assert.throws(() => r.readString());
    });
    test('bytes whose length prefix exceeds remaining bytes throws', () => {
        const r = new Reader(Buffer.from([0x00, 0x00, 0x00, 0x0a, 0x01]));
        assert.throws(() => r.readBytes());
    });
});

describe('uint32', () => {
    for (const v of [0, 1, 258, 2147483648, 4294967295]) {
        test(`round-trips ${v}`, () => {
            assert.strictEqual(roundTrip('writeUInt32', 'readUInt32', v), v);
        });
    }
    test('wire format is big-endian', () => {
        assert.strictEqual(hex('writeUInt32', 1), '00000001');
        assert.strictEqual(hex('writeUInt32', 4294967295), 'ffffffff');
    });
    test('accepts the max uint32 value that writeInt32 would reject', () => {
        // This is the whole reason writeUInt32 exists -- confirm the boundary.
        assert.doesNotThrow(() => new Writer().writeUInt32(4294967295));
        assert.throws(() => new Writer().writeInt32(4294967295));
    });
    test('rejects a negative value', () => {
        assert.throws(() => new Writer().writeUInt32(-1));
    });
    test('rejects a value above the uint32 range', () => {
        assert.throws(() => new Writer().writeUInt32(4294967296));
    });
});

describe('varint', () => {
    const values = [0, 1, -1, 63, 64, -64, -65, 1000000, 2147483647, -2147483648];
    for (const v of values) {
        test(`round-trips ${v}`, () => {
            assert.strictEqual(roundTrip('writeVarint', 'readVarint', v), v);
        });
    }
    test('zig-zag wire format: small values stay small', () => {
        // These are the values most likely to expose a zig-zag direction bug --
        // -1 and 1 would be adjacent after zig-zag, so a sign flip here is
        // the single most common mistake in a varint implementation.
        assert.strictEqual(hex('writeVarint', 0), '00');
        assert.strictEqual(hex('writeVarint', 1), '02');
        assert.strictEqual(hex('writeVarint', -1), '01');
    });
    test('crosses the first single-byte boundary correctly', () => {
        // 63 fits in one byte (continuation bit clear); 64 needs a second byte.
        assert.strictEqual(hex('writeVarint', 63), '7e');
        assert.strictEqual(hex('writeVarint', 64), '8001');
        assert.strictEqual(hex('writeVarint', -64), '7f');
        assert.strictEqual(hex('writeVarint', -65), '8101');
    });
    test('multi-byte value', () => {
        assert.strictEqual(hex('writeVarint', 1000000), '80897a');
    });
    test('int32 boundary values', () => {
        assert.strictEqual(hex('writeVarint', 2147483647), 'feffffff0f');
        assert.strictEqual(hex('writeVarint', -2147483648), 'ffffffff0f');
    });
    test('reader stops at the byte with the continuation bit clear', () => {
        // A multi-byte varint followed by trailing bytes: the reader must not
        // consume more than the varint itself.
        const w = new Writer();
        w.writeVarint(64); // 2 bytes: 80 01
        const trailing = Buffer.from([0x99]);
        const r = new Reader(Buffer.concat([w.toBuffer(), trailing]));
        assert.strictEqual(r.readVarint(), 64);
        assert.strictEqual(r.remaining(), 1);
    });
});

describe('varlong', () => {
    const values = [0n, 1n, -1n, 63n, 64n, -64n, -65n, 4294967296n,
        2n ** 63n - 1n, -(2n ** 63n)];
    for (const v of values) {
        test(`round-trips ${v}`, () => {
            const out = roundTrip('writeVarlong', 'readVarlong', v);
            assert.strictEqual(typeof out, 'bigint');
            assert.strictEqual(out, v);
        });
    }
    test('zig-zag wire format', () => {
        assert.strictEqual(hex('writeVarlong', 0n), '00');
        assert.strictEqual(hex('writeVarlong', 1n), '02');
        assert.strictEqual(hex('writeVarlong', -1n), '01');
    });
    test('value beyond 32-bit range that writeVarint cannot hold', () => {
        // This is the whole reason writeVarlong exists -- confirm it handles
        // a value past where varint would overflow.
        assert.strictEqual(hex('writeVarlong', 4294967296n), '8080808020');
    });
    test('int64 boundary values', () => {
        assert.strictEqual(hex('writeVarlong', 2n ** 63n - 1n), 'feffffffffffffffff01');
        assert.strictEqual(hex('writeVarlong', -(2n ** 63n)), 'ffffffffffffffffff01');
    });
});

describe('array', () => {
    test('round-trips an array of strings', () => {
        const w = new Writer();
        w.writeArray(['alpha', 'beta', 'gamma'], (writer, item) => writer.writeString(item));
        const r = new Reader(w.toBuffer());
        const out = r.readArray((reader) => reader.readString());
        assert.deepStrictEqual(out, ['alpha', 'beta', 'gamma']);
        assert.strictEqual(r.remaining(), 0);
    });
    test('empty array round-trips as [], not null', () => {
        const w = new Writer();
        w.writeArray([], (writer, item) => writer.writeString(item));
        const r = new Reader(w.toBuffer());
        const out = r.readArray((reader) => reader.readString());
        assert.deepStrictEqual(out, []);
    });
    test('wire format: int32 count then elements, no padding between', () => {
        const w = new Writer();
        w.writeArray(['hi'], (writer, item) => writer.writeString(item));
        // count=1 (00000001) then 'hi' as a string (00026869)
        assert.strictEqual(w.toBuffer().toString('hex'), '0000000100026869');
    });
    test('wire format: empty array is just a zero count, nothing else', () => {
        const w = new Writer();
        w.writeArray([], (writer, item) => writer.writeString(item));
        assert.strictEqual(w.toBuffer().toString('hex'), '00000000');
    });
    test('round-trips an array of a non-string element type', () => {
        const w = new Writer();
        w.writeArray([1, 2, 3], (writer, item) => writer.writeInt32(item));
        const r = new Reader(w.toBuffer());
        const out = r.readArray((reader) => reader.readInt32());
        assert.deepStrictEqual(out, [1, 2, 3]);
    });
    test('array nested inside composite data (header-like usage)', () => {
        // This is the shape you'll actually use arrays in -- e.g. a list of
        // topic names inside a Metadata request.
        const w = new Writer();
        w.writeString('client-id');
        w.writeArray(['topic-a', 'topic-b'], (writer, item) => writer.writeString(item));
        w.writeInt32(99);

        const r = new Reader(w.toBuffer());
        assert.strictEqual(r.readString(), 'client-id');
        assert.deepStrictEqual(r.readArray((reader) => reader.readString()), ['topic-a', 'topic-b']);
        assert.strictEqual(r.readInt32(), 99);
        assert.strictEqual(r.remaining(), 0);
    });
});