const POLYNOMIAL = 0x82F63B78;

// precompute a 256-entry lookup table
function build_table() {
    // table of 256 uint32 values
    let table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let crc = i;
        for (let j = 0; j < 8; j++) {
            if ((crc & 1) === 1) {
                crc = (crc >>> 1) ^ POLYNOMIAL;
            } else {
                crc = crc >>> 1;
            }
        }
        table[i] = crc;
    }
    return table;
}

const table = build_table();

// compute the checksum of a buffer, using the table
export function crc32c(bytes) {
    let crc = 0xFFFFFFFF;
    for (const b of bytes) {
        const index = (crc ^ b) & 0xFF;
        crc = (crc >>> 8) ^ table[index];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}