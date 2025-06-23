"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bufSize = bufSize;
exports.bufPush = bufPush;
exports.bufPop = bufPop;
function bufSize(buf) {
    return buf.data.length - buf.readOffset;
}
function bufCapacity(buf) {
    return buf.data.length;
}
function bufPush(data, buf) {
    const newLen = buf.length + data.length;
    if (newLen > bufSize(buf)) {
        //grow the buffer
        let cap = Math.max(bufSize(buf), 32); //minimum size 32 bytes
        while (cap < newLen) {
            cap *= 2;
        }
        let grown = Buffer.alloc(cap);
        buf.data.copy(grown, 0, buf.readOffset); //since we're copying anyway, we should take care of unused space
        buf.data = grown;
        buf.readOffset = 0;
    }
    data.copy(buf.data, buf.readOffset + buf.length, 0); //src.copy(dst, dst_start, src_start, src_end)
    buf.length = newLen;
}
function bufPop(buf, len) {
    //copyWithin is not a Buffer class method, is inherited from TypedArray class since Buffer extends that
    buf.readOffset += len;
    buf.length -= len;
    if (buf.readOffset >= bufCapacity(buf) / 2) {
        buf.data = Buffer.from(buf.data.subarray(buf.readOffset));
        buf.readOffset = 0;
    }
}
