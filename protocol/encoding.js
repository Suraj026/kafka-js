import { Buffer } from 'node:buffer';

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

    // Reads 1 byte as signed int8, advances offset by 1
    readInt8() {
        const value = this.buffer.readInt8(this.offset);
        this.offset += 1;
        return value;
    }

    // Reads 2 bytes as signed int16 advances offset by 2
    readInt16() {
        const value = this.buffer.readInt16BE(this.offset);
        this.offset += 2;
        return value;
    }

    // Reads 4 bytes as signed int32 advances offset by 4
    readInt32() {
        const value = this.buffer.readInt32BE(this.offset);
        this.offset += 4;
        return value;
    }
    
    // Reads 8 bytes as signed int64 advances offset by 8
    readInt64() {
        const value = this.buffer.readBigInt64BE(this.offset);
        this.offset += 8;
        return value;
    }
    
    // Reads int16 length
    readString() {
        const len = this.readInt16();
        if (len === -1) {
            return null;
        }

        // slice string bytes
        const decodedString = this.buffer.toString('utf8', this.offset, this.offset + len);
        this.offset += len;

        return decodedString;
    }

    // Reads int32 length
    readBytes() {
        const len = this.readInt32();
        if (len === -1) {
            return null;
        }

        // slice bytes
        const value = this.buffer.subarray(this.offset, this.offset + len);
        this.offset += len;

        return value;
    }
    // returns bytes not yet consumed
    remaining() {
        return this.buffer.length - this.offset;
    }



}
