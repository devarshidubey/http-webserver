"use strict";
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.countSheep = countSheep;
function countSheep() {
    return __asyncGenerator(this, arguments, function* countSheep_1() {
        for (let i = 0; i < 100; i++) {
            yield __await(new Promise((resolve, reject) => {
                setTimeout(resolve, 1000);
            }));
            yield yield __await(Buffer.from(`${i}\r\n`, 'utf-8'));
        }
    });
}
/*
async function* staticFileGenerator(fp: fs.FileHandle, ranges: HTTPRange[], fileSize: number, boundary: string): BufferGenerator {
    try {
        const multipart = (ranges.length > 1);
        for(let i = 0; i < ranges.length; i++) {
            let [start, end] = processRange(ranges[i], fileSize);
            let size = end - start + 1;
            
            if(multipart) {
                yield Buffer.from(`--${boundary}\r\nContent-Type: text/plain\r\nContent-Range: bytes ${start}-${end}/${fileSize}\r\n\r\n`);
            }
            
            let got = 0;
            const buf = Buffer.allocUnsafe(64 * 1024);
            while(got < size) {
                const data = await fp.read({buffer: buf, length: size - got, position: start});
                got += data.bytesRead;
                start += data.bytesRead;
                yield data.buffer.subarray(0, data.bytesRead);
            }
        }
        if(multipart) {
            yield Buffer.from(`--${boundary}--\r\n`);
        }
    }catch(err) {
        throw err;
    } finally {
        await fp.close(); //if this function throws, it is its own responsibility to close the file before ownership is transfered
    }
}
*/ 
