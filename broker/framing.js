import { Buffer } from 'node:buffer';
import { Writer } from '../protocol/encoding.js';

const MAX_SIZE = 100 * 1024 * 1024;  // 100MB
const LENGTH_PREFIX_BYTES = 4;

export class FrameEncoder {
    /**
     * Every message (request or response) on the wire is length-prefixed
     * +----------------+----------------------------------+
     * | Length (int32) | Message Payload (Length bytes)    |
     * +----------------+----------------------------------+
     * Length is a 4-byte big-endian integer, the byte count of everything that follows
     * The receiver reads 4 bytes to know how many more bytes to buffer before it has a complete message
     */
    static encodeFrame(payload) {
        // check if payload is buffer
        if (!Buffer.isBuffer(payload)) {
            throw new Error('Payload is not a buffer');
        }
        // check if payload length is less than max size
        if (payload.length > MAX_SIZE) {
            throw new Error('Payload is greater than 100MB');
        }

        // create buffer
        const buf = Buffer.alloc(4 + payload.length);

        // write to buffer
        buf.writeInt32BE(payload.length);
        payload.copy(buf, 4, 0, payload.length);

        return buf;
    }
}

export class FrameDecoder {
    /**
     * Maintains per-connection buffer, extracts complete 
     * framed messages from streaming TCP data.
     */
    constructor() {
        this.buffer = Buffer.alloc(0);
    }
    // Appends incoming chunk to internal buffer
    // returns array of complete payloads
    // Call this on every 'data' event
    decode(chunk) {
        // concatenate incoming chunk to buffer
        this.buffer = Buffer.concat([this.buffer, chunk], this.buffer.length + chunk.length);
        const results = []
        while (true) {
            // need more for length
            if (this.buffer.length < 4) {
                break;
            }
            // read length
            const length = this.buffer.readInt32BE(0);
            // validate length
            if (length < 0 || length > MAX_SIZE) {
                this.buffer = Buffer.alloc(0);  // prevent infinite error loop
                throw new Error(`Invalid length of message: ${length}`);
            }
            // incomplete message
            if (this.buffer.length < 4 + length) {
                break;
            }
            // slice payload
            const payload = this.buffer.subarray(4, 4 + length);
            results.push(payload);
            //remove consumed bytes
            this.buffer = this.buffer.subarray(4 + length);
        }
        return results;
    }  
    
    // for dev: exposing remaining buffer
    getRemaining() {
        return this.buffer;
    }
}