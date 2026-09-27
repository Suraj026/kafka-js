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
        const res = buf.writeInt8(v, 0);

        this.buffers.push(res);
        this.length ++;
        return this   
    }

    // Writes a signed 16-bit integer
    writeInt16(v) {
        // allocate a 2-byte buffer
        const buf = Buffer.alloc(2);

        // write value
        const res = buf.writeInt16BE(v, 0);
        
        this.buffers.push(res);
        this.length ++;
        return this   
    }

    // Writes a signed 32-bit integer
    writeInt32(v) {
        // allocate a 4-byte buffer
        const buf = Buffer.alloc(4);

        // write value
        const res = buf.writeInt32BE(v, 0);
        
        this.buffers.push(res);
        this.length ++;
        return this   
    }

    // Writes a signed 64-bit integer
    writeInt8(v) {
        // allocate a 8-byte buffer
        const buf = Buffer.alloc(8);

        // write value
        const res = buf.writeBigInt64BE(v, 0);
        
        this.buffers.push(res);
        this.length ++;
        return this   
    }
}
export class Reader {

}
