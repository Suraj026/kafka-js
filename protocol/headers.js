import { apiKey, apiVersion } from "../broker/constants.js";
import { Writer } from "./encoding.js";

function encoderRequestHeader({apiKey, apiVersion, correlationID, clientID}) {
    /** Every request payload starts with a common header:
     * +---------------+----------------+--------------------+-------------------+
     * | API Key (i16) | API Ver (i16)  | Correlation ID (i32)| Client ID (string)|
     * +---------------+----------------+--------------------+-------------------+
     */
    const w = new Writer();
    w.writeInt16(apiKey);
    w.writeInt16(apiVersion);
    w.writeInt32(correlationID);
    w.writeString(clientID);

    return w.toBuffer();
}

function decodeRequestHeader(reader) {
    apiKey = reader.readInt16();
    apiVersion = reader.readInt16();
    correlationID = reader.readInt32();
    clientID = reader.readString();

    return {apiKey, apiVersion, correlationID, clientID};
}

function encodeResponseHeader({correlationID}) {
    /**
     * Every response payload starts with just the correlation ID:
     * +----------------------+
     * | Correlation ID (i32) |
     * +----------------------+
     */
    const w = new Writer();
    w.writeInt32(correlationID);
    return w.toBuffer();
}

function decodeResponseHeader(reader) {
    correlationID = reader.readInt32();
    return {correlationID};
}