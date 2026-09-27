import { Writer } from "./protocol/encoding.js";
const w = new Writer();
w.writeInt32(1);
console.log(w.toBuffer().toString('hex'));