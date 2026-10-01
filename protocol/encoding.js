import { Buffer } from 'node:buffer';

// helper functions for zigzag and variable length encoding
// Writer class : signed to unsigned
function zigzag32(n) {  // 32 bit
    return (n << 1) ^ (n >> 31)
}
function zigzag64(n) {  // 64 bit
    return (n << 1n) ^ (n >> 63n)
}

// Reader class: unsigned to signed
function unzigzag32(n) {    // 32 bit
    return (n >>> 1) ^ (-(n & 1))
}
function unzigzag64(n) {    // 64 bit
    return (n >> 1n) ^ (-(n & 1n))
}

export class Writer {
    /**
     * Accumulate serialized data in memory into single Buffer
     * and encode into Kafka binary protocol format
     */
    constructor () {
        this.buffers = [];
        this.length = 0;
    }
    // Writes a signed 8-bit integer
    writeInt8(v) {
        // allocate a 1-byte buffer
        const buf = Buffer.alloc(1);

        // write value
        buf.writeInt8(v, 0);

        this.buffers.push(buf);
        this.length ++;
        return this   
    }

    // Writes an unsigned 8-bit integer
    writeUInt8(v) {
        // allocate a 1-byte buffer
        const buf = Buffer.alloc(1);

        // write value
        buf.writeUInt8(v, 0);

        this.buffers.push(buf);
        this.length ++;
        return this   
    }

    // Writes a signed 16-bit integer
    writeInt16(v) {
        // allocate a 2-byte buffer
        const buf = Buffer.alloc(2);

        // write value
        buf.writeInt16BE(v, 0);
        
        this.buffers.push(buf);
        this.length += 2;
        return this   
    }

    // Writes a signed 32-bit integer
    writeInt32(v) {
        // allocate a 4-byte buffer
        const buf = Buffer.alloc(4);

        // write value
        buf.writeInt32BE(v, 0);
        
        this.buffers.push(buf);
        this.length += 4;
        return this   
    }

    // Writes an unsigned 32-bit integer
    writeUInt32(v) {
        // allocate a 4-byte buffer
        const buf = Buffer.alloc(4);

        // write value
        buf.writeUInt32BE(v, 0);
        
        this.buffers.push(buf);
        this.length += 4;
        return this   
    }

    // Writes a signed 64-bit integer
    writeInt64(v) {
        // allocate a 8-byte buffer
        const buf = Buffer.alloc(8);

        // write value
        buf.writeBigInt64BE(v, 0);
        
        this.buffers.push(buf);
        this.length += 8;
        return this   
    }

    // Zig-zag variable-length encoding 
    writeVarint(v) {
        // zigzag encode
        let unsigned = zigzag32(v) >>> 0;
        // variable length encode
        while (unsigned > 0x7F) {
            const byte = (unsigned & 0x7F) | 0x80;    // take low 7 bits and set MSB
            this.writeUInt8(byte);
            unsigned = unsigned >>> 7;
        }
        // final bit - MSB = 0
        this.writeUInt8(unsigned);
        return this
    }

    writeVarlong(v) {
        let unsigned = zigzag64(v);

        while (unsigned > 0x7Fn) {
            const byte = Number(unsigned & 0x7Fn) | 0x80;
            this.writeUInt8(byte);
            unsigned = unsigned >> 7n;
        }

        this.writeUInt8(Number(unsigned));
        return this;
    }

    // Writes a length prefixed utf-8 bytes
    writeString(value) {
        if (value === null) {
            this.writeInt16(-1);
            return this
        }
        // convert string to utf-8 buffer
        const bufString = Buffer.from(value, 'utf8');

        // write string length
        this.writeInt16(bufString.length);
        // push the string to buffer
        this.buffers.push(bufString);
        this.length += bufString.length;

        return this;
    }

    // write length prefixed raw byte array
    writeBytes(buffer) {
        if (buffer === null) {
            this.writeInt32(-1);
            return this;
        }

        // write buffer length
        this.writeInt32(buffer.length);
        // push buffer
        this.buffers.push(buffer);
        this.length += buffer.length;

        return this;
    }

    // count-prefixed arrays
    // Wire format for ALL of them:
    // [INT32 count][Element 1][Element 2]...[Element N]
    writeArray(items, encodeFn) {
        // items: array of any type
        // encodeFn: (writer, item) => void

        // write count as INT32
        this.writeInt32(items.length);
        // write each item using callback
        for (const item of items) {
            encodeFn(this, item); // Callback writes the item using writer methods
        }
        return this;
    }

    // Concatenate all buffers
    toBuffer() {
        const concatBuffer = Buffer.concat(this.buffers, this.length);
        return concatBuffer;
    }
}

export class Reader {
    /**
     * Parses a received Buffer sequentially, maintaining an internal offset. 
     * Used to decode inbound messages from Kafka's binary protocol format.
     */

    constructor(buffer) {
        this.buffer = buffer;
        this.offset = 0;
    }

    // helper function to check out of bounds
    #assertHasBytes(count) {
        if (this.remaining() < count) {
            throw new RangeError(`Insufficient data: need ${count} bytes, only ${this.buffer.length - this.offset} remaining`)
        }
    }

    // Reads 1 byte as signed int8, advances offset by 1
    readInt8() {
        this.#assertHasBytes(1);
        const value = this.buffer.readInt8(this.offset);
        this.offset += 1;
        return value;
    }

    readUInt8() {
        this.#assertHasBytes(1);
        const value = this.buffer.readUInt8(this.offset);
        this.offset += 1;
        return value;
    }

    // Reads 2 bytes as signed int16 advances offset by 2
    readInt16() {
        this.#assertHasBytes(2);
        const value = this.buffer.readInt16BE(this.offset);
        this.offset += 2;
        return value;
    }

    // Reads 4 bytes as signed int32 advances offset by 4
    readInt32() {
        this.#assertHasBytes(4);
        const value = this.buffer.readInt32BE(this.offset);
        this.offset += 4;
        return value;
    }

    // Reads 4 bytes as unsigned int32 advances offset by 4
    readUInt32() {
        this.#assertHasBytes(4);
        const value = this.buffer.readUInt32BE(this.offset);
        this.offset += 4;
        return value;
    }
    
    // Reads 8 bytes as signed int64 advances offset by 8
    readInt64() {
        this.#assertHasBytes(8);
        const value = this.buffer.readBigInt64BE(this.offset);
        this.offset += 8;
        return value;
    }

    readVarint() {
        let result = 0;
        let shift = 0;
        while (true) {
            this.#assertHasBytes(1);
            const byte = this.buffer.readUInt8(this.offset);
            this.offset += 1;

            result |= (byte & 0x7F) << shift;

            if ((byte & 0x80) === 0) {
                break;
            }
            shift += 7;
            if (shift >= 32) {
                throw new RangeError("Varint too long");
            }
        }
        return unzigzag32(result);
    }

    readVarlong() {
        let result = 0n;
        let shift = 0;
        while (true) {
            this.#assertHasBytes(1);
            const byte = this.buffer.readUInt8(this.offset);
            this.offset += 1;

            result |= BigInt(byte & 0x7F) << BigInt(shift);

            if ((byte & 0x80) === 0) {
                break;
            }
            shift += 7;
            if (shift >= 64) {
                throw new RangeError("Varlong too long");
            }
        }
        return unzigzag64(result);
    }
    
    // Reads int16 length
    readString() {
        this.#assertHasBytes(2);
        const len = this.readInt16();
        if (len === -1) {
            return null;
        }
        if (len < 0) {
            throw new RangeError(`Invalid string length: ${len}`);
        }

        // slice string bytes
        this.#assertHasBytes(len);
        const decodedString = this.buffer.toString('utf8', this.offset, this.offset + len);
        this.offset += len;

        return decodedString;
    }

    // Reads int32 length
    readBytes() {
        this.#assertHasBytes(4);
        const len = this.readInt32();
        if (len === -1) {
            return null;
        }
        if (len < 0) {
            throw new RangeError(`Invalid bytes length: ${len}`);
        }

        // slice bytes
        this.#assertHasBytes(len);
        const value = this.buffer.subarray(this.offset, this.offset + len);
        this.offset += len;

        return value;
    }

    // count-prefixed arrays
    // Wire format for ALL of them:
    // [INT32 count][Element 1][Element 2]...[Element N]
    readArray(decodeFn) {
        // decodeFn: (reader) => element
        // Returns: array of decoded elements

        // read count
        const count = this.readInt32();
        // validate count
        if (count < 0) {
            throw new Error("Invalid array count");
        }
        if (count > 1000000) {
            throw new Error("Array count too large");
        }

        // read elements 
        const results = [];
        for (let i = 0; i < count; i++) {
            const element = decodeFn(this);
            results.push(element);
        }
        return results;
    }
    // returns bytes not yet consumed
    remaining() {
        return this.buffer.length - this.offset;
    }



}
