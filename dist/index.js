"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
const net = __importStar(require("net"));
const bufferUtils_1 = require("./bufferUtils");
const httpUtils_1 = require("./httpUtils");
const generatorUtils_1 = require("./generatorUtils");
const mime_1 = require("./mime");
const fs = __importStar(require("fs/promises"));
const pathLib = __importStar(require("path"));
const kMaxHeaderLen = 8 * 1024;
const MAX_CHUNK_SIZE = 1024;
let cachedDate = null;
let lastDateCacheUpdateTime = 0;
const singletonHeaders = new Set([
    'authorization',
    'content-length',
    'content-type',
    'expect',
    'from',
    'host',
    'if-match',
    'if-modified-since',
    'if-none-match',
    'if-range',
    'if-unmodified-since',
    'max-forwards',
    'proxy-authorization',
    'referer',
    //'te',                 // special case: behaves like a list, but RFC says only one field line allowed
    'user-agent'
]);
const strictListHeaders = new Set([
    'range', //a singleton header but allows comma separated multiple values in a single line
    'transfer-encoding',
    'content-encoding',
    'accept-ranges'
]); //these list headers don't allow empty field values
function soInit(socket) {
    let conn = {
        err: null,
        ended: false,
        socket: socket,
        reader: null
    };
    socket.on('end', () => {
        console.log("poipoi");
        conn.ended = true;
        if (conn.reader) {
            conn.reader.resolve(Buffer.from(''));
            conn.reader = null;
        }
    });
    socket.on('close', (hadError) => {
        console.log('Connection ended', hadError ? 'due to error\n' : '\n');
    });
    socket.on('error', (err) => {
        conn.err = err;
        if (conn.reader) {
            conn.reader.reject(err);
            conn.reader = null;
        }
    });
    socket.on('data', (data) => {
        console.assert(conn.reader);
        socket.pause();
        console.log(data.subarray(data.length - 1));
        conn.reader.resolve(data); //! to avoid typescript throwing error: operation on a possible null value, but we assure TS that it will never be null by using !
        conn.reader = null;
    });
    return conn;
}
function soRead(conn) {
    console.assert(!conn.reader);
    return new Promise((resolve, reject) => {
        if (conn.err) {
            reject(conn.err);
            return;
        }
        if (conn.ended) {
            resolve(Buffer.from(''));
            return;
        }
        conn.reader = {
            resolve: resolve,
            reject: reject
        };
        conn.socket.resume();
    });
}
function soWrite(conn, data) {
    return new Promise((resolve, reject) => {
        if (conn.err) {
            reject(conn.err);
            return;
        }
        if (conn.ended) {
            resolve();
            return;
        }
        conn.socket.write(data, (err) => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}
function serveClient(conn /*socket: net.Socket*/) {
    return __awaiter(this, void 0, void 0, function* () {
        //let conn = soInit(socket);
        var _a, _b;
        let buf = { data: Buffer.alloc(0), length: 0, readOffset: 0 };
        while (true) {
            let msg = cutMessage(buf);
            if (!msg) {
                const data = yield soRead(conn);
                if (data.length === 0 && buf.length === 0) {
                    return;
                }
                if (data.length === 0) {
                    throw new httpUtils_1.HTTPError(400, 'BAD REQEUST', 'Unexpected EOF');
                }
                (0, bufferUtils_1.bufPush)(data, buf);
                continue;
            }
            const reqBody = yield readerFromReq(conn, buf, msg);
            const res = yield handleReq(reqBody, msg);
            try {
                yield writeHTTPHeader(conn, res);
                if (msg.method !== 'HEAD')
                    yield writeHTTPBody(conn, res);
            }
            finally {
                (_b = (_a = res.body).close) === null || _b === void 0 ? void 0 : _b.call(_a);
            }
            if (msg.version.toLowerCase() === 'http/1.0') {
                const connectionHeader = fieldGet(msg.headers, 'connection');
                if (!connectionHeader || (connectionHeader && !connectionHeader.includes(Buffer.from('keep-alive'))))
                    return;
            }
            else if (msg.version.toLowerCase() === 'http/1.1') {
                const connectionHeader = fieldGet(msg.headers, 'connection');
                if (connectionHeader && connectionHeader.some((buf) => { return buf.equals(Buffer.from('close')); }))
                    return;
            }
            while ((yield reqBody.read()).length > 0) { /*empty*/ }
            ;
        }
    });
}
function writeHTTPHeader(conn, res) {
    return __awaiter(this, void 0, void 0, function* () {
        if (res.body.length < 0) {
            fieldSet(res.headers, 'Transfer-Encoding', 'chunked');
        }
        else {
            console.assert(!fieldGet(res.headers, 'Content-Length'));
            fieldSet(res.headers, 'Content-Length', res.body.length.toString());
        }
        //fieldSet(res.headers, 'Connection', 'keep-alive');
        yield soWrite(conn, encodeHTTPRes(res)); //sends headers
    });
}
function writeHTTPBody(conn, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const crlf = Buffer.from('\r\n');
        for (let last = false; !last;) {
            let data = yield res.body.read();
            last = (data.length === 0);
            if (res.body.length < 0) {
                data = Buffer.concat([
                    Buffer.from(data.length.toString(16)), crlf,
                    data, crlf
                ]);
            }
            if (data.length > 0) {
                yield soWrite(conn, data);
            }
        }
    });
}
function encodeHTTPRes(res) {
    const statusLine = Buffer.from(res.version.toUpperCase() + " " + res.status_code + " " + res.reason + "\r\n", 'ascii');
    const date = Date.now();
    if (!cachedDate || (date - lastDateCacheUpdateTime > 1000)) {
        const newDate = new Date();
        cachedDate = Buffer.from("Date: " + newDate.toUTCString() + "\r\n", 'ascii');
        lastDateCacheUpdateTime = date;
    }
    let resMessage = Buffer.concat([statusLine, cachedDate]);
    const headerFields = []; //for mutiple fields, concat with comma: exc edge case set-cookie
    res.headers.forEach((value, key, map) => {
        const fieldLine = [];
        fieldLine.push(Buffer.from(key + ":", 'ascii'));
        for (let i = 0; i < value.length; i++) {
            fieldLine.push(value[i]);
            if (i < value.length - 1) {
                fieldLine.push(Buffer.from(",", 'ascii'));
            }
        }
        fieldLine.push(Buffer.from("\r\n", 'ascii'));
        headerFields.push(Buffer.concat(fieldLine));
    });
    return Buffer.concat([resMessage, Buffer.concat(headerFields), Buffer.from('\r\n')]);
}
function handleReq(body, req) {
    return __awaiter(this, void 0, void 0, function* () {
        const uri = req.uri.toString('utf-8');
        const res = {
            version: 'HTTP/1.1', //env var in production or the same as req
            status_code: 200,
            reason: "OK",
            headers: new Map([
                ['server', [Buffer.from('devarshi-server')]],
            ]),
            body: body,
        };
        switch (true) {
            case uri === '/echo':
                fieldSet(res.headers, 'content-type', 'text/plain');
                break;
            case uri === '/sheep':
                res.body = yield readerFromGenerator((0, generatorUtils_1.countSheep)());
                fieldSet(res.headers, 'content-type', 'text/plain');
                break;
            case uri.startsWith('/files/'):
                validateFilePath(uri.substring('/files/'.length));
                return yield staticFileHandler(uri.substring('/files/'.length), req);
            case uri === '/':
                return yield staticFileHandler('home.html', req);
            //fieldSet(res.headers, 'content-type', 'text/plain');
            //res.body = readerFromMemory(Buffer.from('Hello World!', 'utf-8'));
            default:
                throw new httpUtils_1.HTTPError(404, 'Not found', "Requested uri doesn't exist");
        }
        return res;
    });
}
function validateFilePath(path) {
    const pathRegex = /^(?!.*(?:\.\.))(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+(?:\/+)?$/;
    if (!pathRegex.test(path)) {
        throw new httpUtils_1.HTTPError(400, 'BAD REQEUST', 'Invalid uri');
    }
}
function staticFileHandler(path, req) {
    return __awaiter(this, void 0, void 0, function* () {
        const bodyAllowed = !(req.method === 'GET' || req.method === 'HEAD' || req.method === 'TRACE');
        if (!bodyAllowed) {
            return yield serveStaticFile(path, req);
        }
        else {
            throw new httpUtils_1.HTTPError(501, "NOT IMPLEMENTED", 'Cannot POST to the server'); //store a file
        }
    });
}
//all these nested try-catch-finally blocks due to resource ownership management
function serveStaticFile(path, req) {
    return __awaiter(this, void 0, void 0, function* () {
        let fp = null;
        try {
            const fullPath = pathLib.join(__dirname, '..', 'public', path);
            const extName = pathLib.extname(path);
            const contentType = extName ? mime_1.mimeTypes[extName] : "text/plain";
            fp = yield fs.open(fullPath, 'r');
            const stat = yield fp.stat();
            if (!stat.isFile()) {
                return respError(404, "NOT FOUND", "Not a regular file");
            }
            const size = stat.size;
            try {
                return yield staticFileResp(fp, req, size, contentType);
            }
            catch (exc) {
                if (exc instanceof httpUtils_1.HTTPError) {
                    console.info("Error serving file: ", exc);
                    return respError(exc.code, exc.reason, exc.message);
                }
                console.info("Unknown error serving file:", exc);
                return respError(500, "Internal Server Error", "Unknown error");
            }
            finally {
                fp = null; // Ownership transferred to reader; don't close here: reader is now responsible for the file, this function's job is done;
            }
        }
        catch (exc) {
            console.info("Error serving file: ", exc);
            if (path.endsWith('/') || path.endsWith('\\'))
                return respError(404, "NOT FOUND", "Directory not found");
            else
                return respError(404, "NOT FOUND", "File not found");
        }
        finally {
            yield (fp === null || fp === void 0 ? void 0 : fp.close()); //close only when ownership is with it: until reader is called.
        }
    });
}
function parseBytesRanges(ranges) {
    return ranges.map((range) => {
        const idx = range.indexOf(Buffer.from('-'));
        if (idx == 0) {
            return parseDec(range.subarray(idx + 1));
        }
        else if (idx == range.length - 1) {
            return [parseDec(range.subarray(0, idx)), null];
        }
        else {
            return [parseDec(range.subarray(0, idx)), parseDec(range.subarray(idx + 1))];
        }
    });
}
function staticFileResp(fp, req, size, contentType) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let ranges = [];
            const rangeField = fieldGet(req.headers, 'Range');
            if (!rangeField) {
                ranges.push([0, null]);
            }
            else {
                ranges = parseBytesRanges(rangeField);
            }
            const multipart = (ranges.length > 1);
            try {
                const boundary = 'boundary-' + Math.floor((Math.random() * 1e10)).toString() + Math.floor((Math.random() * 1e10)).toString() + Math.floor((Math.random() * 1e10)).toString() + Math.floor((Math.random() * 1e10)).toString();
                const gen = yield staticFileGenerator(fp, ranges, size, boundary); //Once this generator function calls: “The generator is now responsible for closing the file.” ownership transfered
                const reader = yield readerFromGenerator(gen); //no ownership transfer of file, but ownership transfer of generator
                return {
                    version: 'HTTP/1.1',
                    status_code: multipart ? 206 : 200,
                    reason: "OK",
                    headers: new Map([
                        ['content-type', multipart ? [Buffer.from(`multipart/byteranges; boundary=${boundary}`)] : [Buffer.from(contentType, 'ascii')]], //TODO: extract from file type
                    ]),
                    body: reader
                };
            }
            finally {
                fp = null;
            }
        }
        catch (err) {
            yield (fp === null || fp === void 0 ? void 0 : fp.close()); //if this function throws, it is its own responsibility to close the file before ownership is transfered
            if (err instanceof httpUtils_1.HTTPError) {
                return respError(err.code, err.reason, err.message);
            }
            throw new httpUtils_1.HTTPError(500, "Internal server error", "Unknown server error");
        }
        finally {
            yield (fp === null || fp === void 0 ? void 0 : fp.close());
        }
    });
}
function processRange(range, fileSize) {
    if (typeof (range) === "number") {
        return [Math.max(0, fileSize - range), fileSize - 1];
    }
    else {
        if (range[0] >= fileSize)
            throw new httpUtils_1.HTTPError(416, "Range Not Satisfiable", "Range field is out of bounds");
        if (range[1] === null) {
            return [range[0], fileSize - 1];
        }
        else {
            return [range[0], Math.min(fileSize - 1, range[1])];
        }
    }
}
function respError(code, reason, msg) {
    return {
        version: 'HTTP/1.1',
        status_code: code,
        reason: reason,
        headers: new Map([
            ["content-type", [Buffer.from("text/plain", 'ascii')]],
        ]),
        body: readerFromMemory(Buffer.from(msg, 'ascii')),
    };
}
function staticFileGenerator(fp, ranges, fileSize, boundary) {
    return __asyncGenerator(this, arguments, function* staticFileGenerator_1() {
        try {
            const multipart = (ranges.length > 1);
            for (let i = 0; i < ranges.length; i++) {
                let [start, end] = processRange(ranges[i], fileSize);
                let size = end - start + 1;
                //yield the header for byte range
                if (multipart) {
                    yield yield __await(Buffer.from(`--${boundary}\r\nContent-Type: text/plain\r\nContent-Range: bytes ${start}-${end}/${fileSize}\r\n\r\n`));
                }
                let got = 0;
                const buf = Buffer.allocUnsafe(64 * 1024);
                //yield the byte range
                while (got < size) {
                    const data = yield __await(fp.read(buf, 0, size - got, start));
                    got += data.bytesRead;
                    start += data.bytesRead;
                    yield yield __await(data.buffer.subarray(0, data.bytesRead));
                }
                if (multipart)
                    yield yield __await(Buffer.from("\r\n"));
            }
            if (multipart) {
                yield yield __await(Buffer.from(`--${boundary}--\r\n`));
            }
        }
        catch (err) {
            throw err;
        }
        finally {
            yield __await((fp === null || fp === void 0 ? void 0 : fp.close())); //if this function throws, it is its own responsibility to close the file before ownership is transfered
        }
    });
}
function readerFromGenerator(gen) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return {
                length: -1,
                read: () => __awaiter(this, void 0, void 0, function* () {
                    const r = yield gen.next();
                    if (r.done) {
                        return Buffer.from(''); //EOF
                    }
                    console.assert(r.value.length > 0);
                    return r.value;
                }),
                close: () => __awaiter(this, void 0, void 0, function* () {
                    yield gen.return();
                })
            };
        }
        catch (err) {
            yield gen.return(); //since this fucntion owns the generator in case of error(bodyreader not formed)
            throw err;
        }
    });
}
function readerFromMemory(data) {
    let done = false;
    return {
        length: data.length,
        read: () => __awaiter(this, void 0, void 0, function* () {
            if (done) {
                return Buffer.from('', 'utf-8');
            }
            else {
                done = true;
                return data;
            }
        })
    };
}
function readerFromReq(conn, buf, req) {
    return __awaiter(this, void 0, void 0, function* () {
        let bodyLen = -1;
        const contentLen = fieldGet(req.headers, 'Content-Length');
        if (contentLen && contentLen.length === 1) {
            bodyLen = parseDec(contentLen[0]);
            if (isNaN(bodyLen)) {
                throw new httpUtils_1.HTTPError(400, 'BAD REQUEST', 'Invalid Content-Length');
            }
        }
        else if (contentLen && contentLen.length > 1) {
            throw new httpUtils_1.HTTPError(400, 'BAD REQUEST', 'Duplicate Content-Length');
        }
        const bodyAllowed = !(req.method === 'GET' || req.method === 'HEAD' || req.method === 'TRACE');
        const transferEncoding = fieldGet(req.headers, 'Transfer-Encoding'); //TODO: rfc 9110 6.1: if both transfer-encoding: chunked and contentLen: reject or consider T-E and immediately close connection for security
        if (!bodyAllowed && (bodyLen > 0 || transferEncoding)) {
            throw new httpUtils_1.HTTPError(400, 'BAD REQUEST', 'Body not allowed');
        }
        if (!bodyAllowed) {
            bodyLen = 0;
        }
        if (bodyLen >= 0) {
            //handle
            return readerFromConLen(conn, buf, bodyLen);
        }
        else if (transferEncoding && transferEncoding.some((buf) => { return buf.toString('ascii') === 'chunked'; })) {
            return yield readerFromGenerator(readChunks(conn, buf));
            //TODO: implement chunked response
        }
        else {
            throw new httpUtils_1.HTTPError(501, 'Not implemented', 'Content-Length/Transfer-Encoding required');
            //TODO: read the remaining bytes
        }
    });
}
function readChunks(conn, buf) {
    return __asyncGenerator(this, arguments, function* readChunks_1() {
        for (let last = false; !last;) {
            const idx = buf.data.subarray(buf.readOffset, buf.readOffset + buf.length).indexOf(Buffer.from('\r\n'));
            if (idx < 0) { // need more data
                if (buf.length > MAX_CHUNK_SIZE) {
                    throw new httpUtils_1.HTTPError(413, 'Payload Too Large', 'Chunk size too large');
                }
                const data = yield __await(bufExpectMore(conn, buf, 'chunk-data'));
                continue;
            }
            if (idx + 1 > MAX_CHUNK_SIZE) {
                throw new httpUtils_1.HTTPError(413, 'Payload Too Large', 'Chunk size too large');
            }
            let remain = parseChunkHeader(buf.data.subarray(buf.readOffset, buf.readOffset + idx)); //parse chunk size
            (0, bufferUtils_1.bufPop)(buf, idx + 2); //remove line
            if (Number.isNaN(remain)) {
                throw new httpUtils_1.HTTPError(400, 'BAD REQUEST', "Bad chunk");
            }
            last = (remain === 0);
            while (remain) {
                if (buf.length === 0) {
                    yield __await(bufExpectMore(conn, buf, 'chunk data'));
                }
                const consume = Math.min(remain, buf.length);
                const data = buf.data.subarray(buf.readOffset, buf.readOffset + consume);
                (0, bufferUtils_1.bufPop)(buf, consume);
                remain -= consume;
                yield yield __await(Buffer.from(data)); //costs 1 memcpy but it's safer for data validity
            }
            //await bufExpectMore(conn, buf, 'chunk data');
            while (buf.length < 2) {
                yield __await(bufExpectMore(conn, buf, 'chunk data'));
            }
            if (buf.data[buf.readOffset] !== 0x0D || buf.data[buf.readOffset + 1] !== 0x0A) {
                throw new httpUtils_1.HTTPError(400, 'BAD REQUEST', 'Missing CRLF after chunk data');
            }
            (0, bufferUtils_1.bufPop)(buf, 2);
        }
    });
}
function bufExpectMore(conn, buf, debugLabel) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield soRead(conn); // read from socket
        if (data.length === 0) {
            throw new httpUtils_1.HTTPError(400, 'BAD REQUEST', `Unexpected EOF while reading ${debugLabel}`);
        }
        (0, bufferUtils_1.bufPush)(data, buf); // append to your dynamic buffer
    });
}
function parseChunkHeader(chunkSize) {
    const str = chunkSize.toString('ascii');
    return parseInt(str, 16);
}
function readerFromConLen(conn, buf, remain) {
    return {
        length: remain,
        read: () => __awaiter(this, void 0, void 0, function* () {
            if (remain === 0) {
                return Buffer.from('');
            }
            if (buf.length === 0) {
                const data = yield soRead(conn);
                if (data.length === 0) { //EOF before full content
                    throw new httpUtils_1.HTTPError(400, 'BAD REQUEST', 'Unexpected EOF from HTTP Body');
                }
                (0, bufferUtils_1.bufPush)(data, buf);
            }
            const consume = Math.min(remain, buf.length); //closure property: even after this scope where remain is an arg ends, the func read() remembers this remain everywherer this object is referenced!!
            remain -= consume;
            const data = Buffer.from(buf.data.subarray(buf.readOffset, buf.readOffset + consume));
            (0, bufferUtils_1.bufPop)(buf, consume);
            return data;
        })
    };
}
function parseDec(num) {
    const str = num.toString('ascii');
    if (!/^\d+$/.test(str)) {
        return NaN;
    }
    return Number(str);
}
function fieldGet(headers, fieldName) {
    if (headers.has(fieldName.toLowerCase())) {
        return headers.get(fieldName.toLowerCase());
    }
    return null;
}
function fieldSet(headers, fieldName, fieldValue) {
    if (headers.has(fieldName.toLowerCase())) {
        headers.get(fieldName.toLowerCase()).push(Buffer.from(fieldValue, 'ascii'));
        return;
    }
    headers.set(fieldName, [Buffer.from(fieldValue, 'ascii')]);
}
function cutMessage(buf) {
    const idx = buf.data.subarray(buf.readOffset, buf.readOffset + buf.length).indexOf("\r\n\r\n");
    if (idx < 0) {
        if (buf.length >= kMaxHeaderLen) {
            throw new httpUtils_1.HTTPError(431, "Header too long", 'Request Header Fields Too Large');
        }
        return null;
    }
    if (idx + 1 >= kMaxHeaderLen) {
        throw new httpUtils_1.HTTPError(431, "Header too long", 'Request Header Fields Too Large');
    }
    const msg = parseHTTPReq(buf.data.subarray(buf.readOffset, buf.readOffset + idx + 4)); //Buffer.from(buf.data.subarray(buf.readOffset, buf.readOffset+idx+1));
    (0, bufferUtils_1.bufPop)(buf, idx + 4); //pop from front: buffer, len
    return msg;
}
function parseHTTPReq(buf) {
    //get the request Line
    const lines = splitLines(buf);
    const [method, uri, version] = parseRequestLine(lines[0]);
    const headers = new Map();
    for (let i = 1; i < lines.length - 1; i++) {
        const header = lines[i]; //Buffer.from(lines[i]);
        if (!validateHeader(header)) {
            throw new httpUtils_1.HTTPError(400, 'BAD REQUEST', "Bad field");
        }
        parseHeader(header, headers);
    }
    console.assert(lines[lines.length - 1].length === 0);
    return {
        method: method.toString('ascii').toUpperCase(),
        uri: uri,
        version: version.toString('ascii'),
        headers: headers,
    };
}
function parseHeader(header, headers) {
    const idx = header.indexOf(":");
    const fieldName = Buffer.from(header.subarray(0, idx));
    let fieldValue = trimBuffer(Buffer.from(header.subarray(idx + 1)));
    const key = fieldName.toString('ascii').toLowerCase();
    if (key === 'range') {
        if (headers.has(key))
            throw new httpUtils_1.HTTPError(400, 'BAD REQUEST', "Multiple Range headers are not allowed");
        if (!validateRangeHeader(fieldValue)) {
            console.log("invalid range header");
            headers.set(key, [Buffer.from("0-")]);
            return;
        }
        fieldValue = fieldValue.subarray(6);
    }
    let openQuote = false;
    let start = 0;
    let parts = [];
    let subParts = [];
    for (let i = 0; i < fieldValue.length; ++i) {
        const byte = fieldValue[i];
        if (openQuote && byte === 0x5C) { //0x5C === \  escape has syntactical meaning only inside a quoted string
            subParts.push(fieldValue.subarray(start, i));
            start = ++i; //escape the next character
            continue;
        }
        if (byte === 0x22) { //quote 
            subParts.push(fieldValue.subarray(start, i));
            start = i + 1;
            openQuote = !openQuote;
        }
        else if (!openQuote && byte === 0x2C && singletonHeaders.has(key)) { // comma
            throw new httpUtils_1.HTTPError(400, 'Bad request', `Multiple field values for singleton header ${key}`);
        }
        else if (!openQuote && byte === 0x2C) { //comma separater outside of quoted string
            subParts.push(fieldValue.subarray(start, i));
            let part = trimBuffer(Buffer.concat(subParts));
            subParts = [];
            if (part.length > 0)
                parts.push(part);
            else if (strictListHeaders.has(key))
                throw new httpUtils_1.HTTPError(400, 'Bad request', `Empty field values not allowed for comma separated ${key} header`);
            start = i + 1;
        }
    }
    if (openQuote)
        throw new httpUtils_1.HTTPError(400, "Bad request", `Unterminated string`);
    subParts.push(fieldValue.subarray(start));
    const lastPart = trimBuffer(Buffer.concat(subParts));
    subParts = [];
    if (lastPart.length > 0) {
        parts.push(lastPart);
    }
    else if (strictListHeaders.has(key)) {
        throw new httpUtils_1.HTTPError(400, 'BAD REQUEST', `Empty field values not allowed for comma-separated '${key}' header`);
    }
    if (!headers.has(key)) {
        headers.set(key, parts);
    }
    else {
        headers.get(key).push(...parts);
    }
}
function validateRangeHeader(fieldValue) {
    let val = fieldValue.toString('ascii').toLowerCase();
    if (!val.startsWith('bytes='))
        throw new httpUtils_1.HTTPError(400, 'BAD REQUEST', "Wrong Range header field ");
    val = val.substring(6);
    const pattern = /^(?:\d+-\d*|-\d+)(?:,(?:\d+-\d*|-\d+))*$/;
    return pattern.test(val);
}
function trimBuffer(buf) {
    let start = 0;
    let end = buf.length - 1;
    while (start <= end && (buf[start] === 0x20 || buf[start] === 0x09))
        start++;
    while (start <= end && (buf[end] === 0x20 || buf[end] === 0x09))
        end--;
    return buf.subarray(start, end + 1);
}
function validateHeader(header) {
    const headerLine = header.toString('ascii');
    const headerLineRegex = /^([!#$%&'*+\-.^_`|~0-9A-Za-z]+):[ \t]*([\x21-\x7E\x80-\xFF]*(?:[ \t\x21-\x7E\x80-\xFF]+[\x21-\x7E\x80-\xFF])?)[ \t]*$/;
    if (!headerLineRegex.test(headerLine))
        return false;
    return true;
}
function parseRequestLine(buf) {
    let requestLine = [];
    let start = 0;
    for (let i = 0; i < 2; i++) {
        let idx = buf.indexOf(" ", start);
        if (idx === -1 || idx + 1 > buf.length) {
            throw new httpUtils_1.HTTPError(400, 'BAD REQUEST', "Invalid request line syntax");
        }
        requestLine.push(Buffer.from(buf.subarray(start, idx)));
        start = idx + 1;
    }
    requestLine.push(Buffer.from(buf.subarray(start)));
    return requestLine;
}
function splitLines(buf) {
    let lines = [];
    let start = 0;
    while (start < buf.length) {
        const end = buf.indexOf("\r\n", start);
        lines.push(buf.subarray(start, end));
        start = end + 2;
    }
    return lines;
}
function newConn(conn /*socket: net.Socket*/) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield serveClient(conn);
        }
        catch (exc) {
            console.error('exception', exc);
            if (exc instanceof httpUtils_1.HTTPError) {
                const message = exc.message;
                const res = {
                    version: 'HTTP/1.1',
                    status_code: exc.code,
                    reason: exc.reason,
                    headers: new Map([
                        ["content-type:", [Buffer.from("text/plain", 'ascii')]],
                    ]),
                    body: readerFromMemory(Buffer.from(message, 'utf-8')),
                };
                try {
                    yield writeHTTPHeader(conn, res);
                    yield writeHTTPBody(conn, res);
                }
                catch (exc) {
                    console.error('exception', exc);
                }
            }
        }
        finally {
            conn.socket.destroy();
        }
    });
}
function connInit(server) {
    let listener = {
        server: server,
        err: null,
        closed: false,
        sockets: [],
        pendingConnection: null,
    };
    server.on('close', () => {
        listener.sockets = [];
        listener.closed = true;
        if (listener.pendingConnection) {
            listener.pendingConnection.reject(new Error("Server Closed"));
            listener.pendingConnection = null;
        }
    });
    server.on('error', (err) => {
        listener.sockets = [];
        listener.err = err;
        if (listener.pendingConnection) {
            listener.pendingConnection.reject(err);
            listener.pendingConnection = null;
        }
    });
    server.on('connection', (socket) => {
        if (listener.pendingConnection) {
            listener.pendingConnection.resolve(soInit(socket));
            listener.pendingConnection = null;
        }
        else {
            listener.sockets.push(socket);
        }
    });
    return listener;
}
function soListen(address) {
    const server = net.createServer({
        pauseOnConnect: true,
        noDelay: true,
    });
    let listener = connInit(server);
    server.listen(address, () => { console.log("Listening\n"); });
    return listener;
}
function soAccept(listener) {
    console.assert(!listener.pendingConnection);
    return new Promise((resolve, reject) => {
        if (listener.err) {
            reject(listener.err);
            return;
        }
        if (listener.closed) {
            reject(new Error("Server closed before connection was accepted"));
        }
        if (listener.sockets.length > 0) {
            let socket = listener.sockets.shift();
            resolve(soInit(socket));
            return;
        }
        listener.pendingConnection = {
            resolve: resolve,
            reject: reject
        };
    });
}
let listener = soListen({
    host: '127.0.0.1',
    port: 1234,
});
function acceptLoop(listener) {
    return __awaiter(this, void 0, void 0, function* () {
        while (true) {
            try {
                let conn = yield soAccept(listener);
                console.log("Connected: ", conn.socket.remoteAddress, ":", conn.socket.remotePort);
                newConn(conn);
            }
            catch (err) {
                console.error(err);
                break;
            }
        }
    });
}
acceptLoop(listener);
