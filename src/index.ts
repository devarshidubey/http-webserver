import * as net from "net";
import { DynBuf, bufPush, bufPop, bufSize } from "./bufferUtils";
import { HTTPReq, HTTPRes, BodyReader, HTTPError } from  "./httpUtils";
import { BufferGenerator, countSheep } from "./generatorUtils"
import * as fs from "fs/promises"
import * as pathLib from "path"

const kMaxHeaderLen = 8*1024;
const MAX_CHUNK_SIZE = 1024;
let cachedDate: Buffer | null = null
let lastDateCacheUpdateTime: number = 0;

type TCPConn = {
	socket: net.Socket;
	
	err: null | Error;
	
	ended: boolean;
	
	reader: null | {
		resolve: (value: Buffer) => void,
		reject: (reason: Error) => void,
	};
};

function soInit(socket: net.Socket): TCPConn{
	let conn: TCPConn = {
		err: null,
		ended: false,
		socket: socket,
		reader: null
	};
	
	socket.on('end', ()=> {
		conn.ended = true;
		if(conn.reader) {
			conn.reader.resolve(Buffer.from(''));
			conn.reader = null;
		}
	});
	
	socket.on('close', (hadError) => {
		  console.log('Connection ended', hadError ? 'due to error\n' : '\n');
	});

	
	socket.on('error', (err: Error)=> {
		conn.err = err;
		if(conn.reader) {
			conn.reader.reject(err);
			conn.reader = null;
		}
	})
	
	socket.on('data', (data: Buffer)=> {
		console.assert(conn.reader);
		socket.pause();
		
		conn.reader!.resolve (data); //! to avoid typescript throwing error: operation on a possible null value, but we assure TS that it will never be null by using !
		conn.reader = null;
	});
	
	return conn;
}

function soRead(conn: TCPConn): Promise<Buffer> {
	console.assert(!conn.reader);
	
	return new Promise<Buffer>((resolve, reject) => {
		if(conn.err) {
			reject(conn.err);
			return;
		}
		
		if(conn.ended) {
			resolve(Buffer.from(''));
			return;
		}
		
		conn.reader = {
			resolve: resolve,
			reject: reject
		}

		conn.socket.resume();
	});
}
function soWrite(conn: TCPConn, data: Buffer): Promise<void> {
	return new Promise((resolve, reject)=> {
		if(conn.err) {
			reject(conn.err);
			return;
		}
		
		if(conn.ended) {
			resolve();
			return;
		}
		
		conn.socket.write(data, (err: Error | null | undefined) =>{  //This callback is called when: The data has been flushed to the OS kernel's internal buffer
			if(err) {
				reject(err);
			} else {
				resolve();
			}
		});
	});
}

async function serveClient(conn: TCPConn/*socket: net.Socket*/): Promise<void>{
	//let conn = soInit(socket);

	let buf: DynBuf = {data: Buffer.alloc(0), length: 0, readOffset: 0};
	
	while(true) { 
		let msg: null | HTTPReq = cutMessage(buf);
		if(!msg){
			const data:Buffer = await soRead(conn);
			if(data.length === 0 && buf.length === 0) {
				//console.log('Connection ended\n'); //need to revamp it: proper flag for connection end
				return;
			}
			
			if(data.length === 0) { 
				throw new HTTPError(400, 'Unexpected EOF');
			}
			
			bufPush(data, buf);
			continue;
		}
		
		//get reqbody
		
		const reqBody: BodyReader = readerFromReq(conn, buf, msg);
		
		const res: HTTPRes = await handleReq(reqBody, msg);
		
		try{
			await writeHTTPRes(conn, res);
		} finally {
			res.body.close?.();
		}
		
		if(msg.version.toLowerCase() === 'http/1.0') {
			return;
		}
		
		while((await reqBody.read()).length > 0) { /*empty*/} //find out what this does
	}
}

async function writeHTTPRes(conn: TCPConn, res: HTTPRes): Promise<void> {
	if(res.body.length < 0 ) {
		fieldSet(res.headers, 'Transfer-Encoding', 'chunked');
	} 
	else {
		console.assert(!fieldGet(res.headers, 'Content-Length'));
		fieldSet(res.headers, 'Content-Length', res.body.length.toString());
	}
	
	await soWrite(conn, encodeHTTPRes(res)); //sends headers
	const crlf = Buffer.from('\r\n');
	 
	for(let last = false; !last;) {
		let data: Buffer = await res.body.read();

		last = (data.length === 0)
		
		if(res.body.length < 0 ) {
			data = Buffer.concat([
				Buffer.from(data.length.toString(16)), crlf, 
				data, crlf
			]);
		}
		if(data.length > 0) {
			await soWrite(conn, data);
		}
	}
}

function encodeHTTPRes(res: HTTPRes): Buffer { //writes header
	const statusLine = Buffer.from(res.version.toUpperCase()+" "+res.status_code+"\r\n", 'ascii');

	const date = Date.now();
	if(!cachedDate || (date - lastDateCacheUpdateTime > 1000)) {
		const newDate = new Date();
		cachedDate =  Buffer.from("Date: " + newDate.toUTCString() + "\r\n", 'ascii');
		lastDateCacheUpdateTime = date;
	}
	
	let resMessage = Buffer.concat([statusLine, cachedDate])
	const headerFields: Buffer[] = []    //for mutiple fields, concat with comma: exc edge case set-cookie
	
	res.headers.forEach((value: Buffer[], key: string, map)=> {
		const fieldLine = []
		fieldLine.push(Buffer.from(key+":", 'ascii'));
		
		for(let i = 0; i < value.length; i++) {
			fieldLine.push(value[i]);
			if(i < value.length - 1) {
				fieldLine.push(Buffer.from(",", 'ascii'));
			}
		}
		fieldLine.push(Buffer.from("\r\n", 'ascii'));
		headerFields.push(Buffer.concat(fieldLine))
	})
	return Buffer.concat([resMessage, Buffer.concat(headerFields), Buffer.from('\r\n')]);
}

async function handleReq(body: BodyReader, req: HTTPReq): Promise<HTTPRes> { //async to add io read in the future
	let resBody: BodyReader;
	const uri: string = req.uri.toString('utf-8')
	switch(true) {
	case uri === '/echo':
		resBody = body;
		break;
	case uri === '/sheep':
		resBody = readerFromGenerator(countSheep());
		break;
	case uri.startsWith('/files/'):
		validateFilePath(uri.substr('/files/'.length));
		return await serveStaticFile(uri.substr('/files/'.length));
	default:
		resBody = readerFromMemory(Buffer.from('Hello World!\n', 'utf-8'));
	}
	
	return {
		version: 'HTTP/1.1',//env var in production or the same as req
		status_code: 200,
		reason: "OK",
		headers: new Map([
			['server', [Buffer.from('my_first_http_server')]],
		]),
		body: resBody,
	}
}

function validateFilePath(path: string): void {
	const pathRegex =/^(?!.*(?:\.\.))(?:[a-zA-Z0-9_\-\.]+\/)*[a-zA-Z0-9_\-\.]*$/
	if(!pathRegex.test(path)) {
		throw new HTTPError(400, 'Bad uri');
	}
}


async function serveStaticFile(path: string): Promise<HTTPRes> {
	let fp: null | fs.FileHandle = null;
	try {
		const fullPath = pathLib.join(__dirname, '..', 'public', path);
		fp = await fs.open(fullPath, 'r');
		
		const stat = await fp.stat();
		if(!stat.isFile()) {
			return resp404("Not a regular file");
		}
		
		const size = stat.size;
		
		const reader = readerFromStaticFile(fp, size);
		fp =null;
		return {
			version: 'HTTP/1.1',
			status_code: 200,
			reason: null,
			headers: new Map([
				['content-type', [Buffer.from('text/plain','ascii')]],
			]),
			body: reader
		}
		
	} catch(exc) {
		console.info("Error serving file: ", exc);
		return resp404("File not found");
	} finally {
		await fp?.close();
	}
}

function resp404(msg: string): HTTPRes {
	 return {
		version: 'HTTP/1.1',
		status_code: 404,
		reason: null,
		headers : new Map<string, Buffer[]>([
			["content-type", [Buffer.from("text/plain", 'ascii')]],
		]),
		body: readerFromMemory(Buffer.from(msg, 'ascii')),
	}
}

function readerFromStaticFile(fp: fs.FileHandle, size: number): BodyReader {
	let got = 0;
	const buf = Buffer.allocUnsafe(65537); //reusable uninitialized buffer: constant time initialization
	return {
		length: -1,
		read: async (): Promise<Buffer> => {
			if(got === size) {
				return Buffer.from('', 'utf-8')
			}
			
			//const readBuffer = Buffer.alloc(16384); //default behavior in nodejs 20+
			const readData = await fp.read({buffer: buf});

			got += readData.bytesRead;
			if(got > size) {
				throw new Error("File changed while reading");
			}
			
			return readData.buffer.subarray(0, readData.bytesRead);
		},
		close: async (): Promise<void> =>{
			await fp.close();
		}
	}
}

function readerFromGenerator(gen: BufferGenerator): BodyReader {
	return {
		length: -1,
		read: async(): Promise<Buffer> => {
			const r = await gen.next();
			if(r.done) {
				return Buffer.from(''); //EOF
			}
			console.assert(r.value.length > 0);
			return r.value;
		},
		close: async(): Promise<void> => {
			await gen.return();
		}
	}
}

function readerFromMemory(data: Buffer): BodyReader {
	let done = false;
	return {
		length: data.length,
		read: async (): Promise<Buffer> =>{
			if(done) {
				return Buffer.from('', 'utf-8');
			}
			else {
				done = true;
				return data;
			}
		}
	}
}

function readerFromReq(conn: TCPConn, buf: DynBuf,  req: HTTPReq): BodyReader {
	let bodyLen:number = -1;
	
	const contentLen: Buffer[] | null = fieldGet(req.headers, 'Content-Length');

	if(contentLen && contentLen!.length === 1) {
		bodyLen = parseDec(contentLen![0]);
		if(isNaN(bodyLen)) {
			throw new HTTPError(400, 'Bad Content-Length');
		}
	}
	else if(contentLen && contentLen!.length > 1) {
		throw new HTTPError(400, 'Duplicate Content-Length');
	}
	
	const bodyAllowed = !(req.method === 'GET' || req.method === 'HEAD' || req.method === 'TRACE');
	const transferEncoding: null | Buffer[] = fieldGet(req.headers, 'Transfer-Encoding'); //TODO: rfc 9110 6.1: if both transfer-encoding: chunked and contentLen: reject or consider T-E and immediately close connection for security
	if(!bodyAllowed && (bodyLen > 0 || transferEncoding)) {
		throw new HTTPError(400, 'Body not allowed');
	}
	if(!bodyAllowed) {
		bodyLen = 0;
	}
	
	if(bodyLen >= 0) {
		//handle
		return readerFromConLen(conn, buf, bodyLen);
	}
	else if(transferEncoding && transferEncoding!.some((buf)=> {return buf.toString('ascii') === 'chunked'})) {
		return readerFromGenerator(readChunks(conn, buf));
		//TODO: implement chunked response
	}
	else {
		throw new HTTPError(501, 'Not implemented');
		//TODO: read the remaining bytes
	}
}

async function*  readChunks(conn: TCPConn, buf: DynBuf): BufferGenerator {

	for(let last = false; !last;) {		
		const idx = buf.data.subarray(buf.readOffset, buf.readOffset+ buf.length).indexOf(Buffer.from('\r\n'));
		if(idx < 0) {// need more data
			if (buf.length > MAX_CHUNK_SIZE) {
				throw new HTTPError(413, 'Chunk size too large');
			}
			const data = await bufExpectMore(conn, buf, 'chunk-data');
			continue;
		}
		
		if (idx+1 > MAX_CHUNK_SIZE) {
				throw new HTTPError(413, 'Chunk size too large');
		}
		let remain = parseChunkHeader(buf.data.subarray(buf.readOffset, buf.readOffset+idx)); //parse chunk size
		bufPop(buf, idx+2); //remove line
				
		if(Number.isNaN(remain)) {
			throw new HTTPError(400, "Bad chunk");
		}
		last = (remain === 0);
		
		while(remain) {
			if(buf.length === 0) {
				await bufExpectMore(conn, buf, 'chunk data');
			}
			
			const consume = Math.min(remain, buf.length);
			const data = buf.data.subarray(buf.readOffset, buf.readOffset + consume);
			bufPop(buf, consume);
			remain-=consume;
			
			yield Buffer.from(data); //costs 1 memcpy but it's safer for data validity
		}
		
		//await bufExpectMore(conn, buf, 'chunk data');
		while(buf.length < 2) {
			await bufExpectMore(conn, buf, 'chunk data');
		}
		
		if(buf.data[buf.readOffset] !== 0x0D || buf.data[buf.readOffset + 1] !== 0x0A) {
			throw new HTTPError(400, 'Missing CRLF after chunk data');
		}
		
		bufPop(buf, 2);
	}
}

async function bufExpectMore(conn: TCPConn, buf: DynBuf, debugLabel: string): Promise<void> {
	const data = await soRead(conn);   // read from socket
	
	if (data.length === 0) {
		throw new HTTPError(400, `Unexpected EOF while reading ${debugLabel}`);
	}
	bufPush(data, buf);  // append to your dynamic buffer
}


function parseChunkHeader(chunkSize: Buffer): number {
	const str = chunkSize.toString('ascii');
	return parseInt(str, 16);

}

function readerFromConLen(conn: TCPConn, buf: DynBuf, remain: number): BodyReader {
	return {
		length: remain,
		read: async (): Promise<Buffer> => {
			if(remain === 0) { 
				return Buffer.from('');
			}
			if(buf.length === 0) {
				const data = await soRead(conn);
				if(data.length === 0) { //EOF before full content
					throw new HTTPError(400, 'Unexpected EOF from HTTP Body');
				}
				bufPush(data, buf);
			}
			const consume = Math.min(remain, buf.length);//closure property: even after this scope where remain is an arg ends, the func read() remembers this remain everywherer this object is referenced!!
			remain -= consume;
			const data = Buffer.from(buf.data.subarray(buf.readOffset, buf.readOffset+consume));
			bufPop(buf, consume);
			return data;
		}
	}
}

function parseDec(num: Buffer):number {
	const str = num.toString('ascii');
	if(!/^\d+$/.test(str)) {
		return NaN;
	}
	return Number(str);
}

function fieldGet(headers: Map<string, Buffer[]>, fieldName: string): null | Buffer[] { //also need to handle the case where field sent as: field-name: val1, val2, val3 .... instead of sparate
	if(headers.has(fieldName.toLowerCase())) {
		return headers.get(fieldName.toLowerCase())!;
	}
	return null;
}

function fieldSet(headers: Map<string, Buffer[]>, fieldName: string, fieldValue: string):void { //also need to handle the case where field sent as: field-name: val1, val2, val3 .... instead of sparate
	if(headers.has(fieldName.toLowerCase())) {
		headers.get(fieldName.toLowerCase())!.push(Buffer.from(fieldValue, 'ascii'));
		return;
	}
	headers.set(fieldName, [Buffer.from(fieldValue, 'ascii')]);
}

function cutMessage(buf: DynBuf): null | HTTPReq{
	const idx: number = buf.data.subarray(buf.readOffset, buf.readOffset + buf.length).indexOf("\r\n\r\n");
	
	if(idx < 0) {
		if(buf.length >= kMaxHeaderLen) {
			throw new HTTPError(431, "Header too long");
		}
		return null;
	}
	if(idx+1 >= kMaxHeaderLen) {
		throw new HTTPError(431, "Header too long");
	}
	const msg: HTTPReq = parseHTTPReq(buf.data.subarray(buf.readOffset, buf.readOffset+idx+4));//Buffer.from(buf.data.subarray(buf.readOffset, buf.readOffset+idx+1));
	
	bufPop(buf, idx+4); //pop from front: buffer, len
	return msg;
}
 
function parseHTTPReq(buf: Buffer): HTTPReq {
	//get the request Line
	const lines: Buffer[] = splitLines(buf);
	
	const [method, uri, version] = parseRequestLine(lines[0]);
	
	const headers = new Map<string, Buffer[]>();
	for(let i = 1; i < lines.length - 1; i++) {
		const header = lines[i]; //Buffer.from(lines[i]);
		if(!validateHeader(header)) {
			throw new HTTPError(400, "Bad field");
		}
		const [fieldName, fieldValue] = parseHeader(header);
		const key = fieldName.toString('ascii').toLowerCase();
		
		if(headers.has(key)) {
			headers.get(key)!.push(fieldValue); //may contain ows, field get fucntion trims these
		} else {
			headers.set(key, [fieldValue])
		}
	}
	
	console.assert(lines[lines.length - 1].length === 0);
	return {
		method: method.toString('ascii').toUpperCase(),
		uri: uri,
		version: version.toString('ascii'),
		headers: headers,
	}
}
function parseHeader(header: Buffer): Buffer[] { //TODO: check for comma spearators first, also check for "" escape to ignore comma inside field value
	const idx = header.indexOf(":");
	const fieldName = Buffer.from(header.subarray(0, idx));
	const fieldValue = trimBuffer(Buffer.from(header.subarray(idx+1)));
	
	return [fieldName, fieldValue]; //send fieldValues if there are multiple fieldvalues in the same headerline
}

function trimBuffer(buf: Buffer): Buffer {
	let start = 0;
	let end = buf.length - 1;
	while(start <= end && (buf[start] === 0x20 || buf[start] === 0x09)) start++;
	while(start <= end && (buf[end] === 0x20 || buf[end] === 0x09)) end--;
	
	return buf.slice(start, end+1);
}

function validateHeader(header: Buffer): boolean {
	const headerLine = header.toString('ascii');
	const headerLineRegex = /^([!#$%&'*+\-.^_`|~0-9A-Za-z]+):[ \t]*([\x21-\x7E\x80-\xFF]*(?:[ \t\x21-\x7E\x80-\xFF]+[\x21-\x7E\x80-\xFF])?)[ \t]*$/;
	
	if(!headerLineRegex.test(headerLine)) return false;
	return true;

}

function parseRequestLine(buf: Buffer): Buffer[] {
	let requestLine = []
	let start = 0;
	
	for(let i = 0; i < 2; i++) {
		let idx = buf.indexOf(" ", start);
		if(idx === -1 || idx+1 > buf.length) {
			throw new HTTPError(400, "Invalid request line syntax");
		}
		requestLine.push(Buffer.from(buf.subarray(start, idx)));
		start = idx+1;
	}
	requestLine.push(Buffer.from(buf.subarray(start)));
	
	return requestLine;
}

function splitLines(buf: Buffer): Buffer[]{
	let lines: Buffer[] = [];
	let start = 0;
	while(start < buf.length) {
		const end = buf.indexOf("\r\n", start);
		lines.push(buf.subarray(start, end));
		start = end+2;
	}
	return lines;
} 

async function newConn(conn: TCPConn/*socket: net.Socket*/): Promise<void> {
	try {
		await serveClient(conn);
	} catch(exc) {
		console.error('exception', exc)
		if(exc instanceof HTTPError) {
			const message = exc.message;
			const res: HTTPRes = {
				version: 'HTTP/1.1',
				status_code: exc.code,
				reason: null,
				headers : new Map<string, Buffer[]>([
					["content-type:", [Buffer.from("text/plain", 'ascii')]],
				]),
				body: readerFromMemory(Buffer.from(message, 'utf-8')),
			}
			try {
				await writeHTTPRes(conn, res);
			} catch(exc) {console.error('exception', exc)}
		}
	} finally {
		conn.socket.destroy();
	}
}


/** listener **/

type TCPListener = {
	server: net.Server
	sockets: net.Socket[];  //stored pending sockets waiting for a promise: unbounded memory usage risk, implement a buffer size for this
	err: null | Error;
	closed: boolean;
	pendingConnection: null | {
		resolve: (value: TCPConn)=> void,
		reject: (reason: Error) => void
	}
};

function connInit(server: net.Server) {
	let listener: TCPListener = {
		server: server,
		err: null,
		closed: false,
		sockets: [],
		pendingConnection: null,
	}
	
	server.on('close', ()=> {
		listener.sockets = [];
		listener.closed = true;
		if(listener.pendingConnection) {
			listener.pendingConnection.reject(new Error("Server Closed"));
			listener.pendingConnection = null;
		}
	});
	
	server.on('error', (err) =>{
		listener.sockets = [];
		listener.err = err;
		if(listener.pendingConnection) {
			listener.pendingConnection.reject(err);
			listener.pendingConnection = null;
		}
		
	});
	
	server.on('connection', (socket: net.Socket)=> {
		
		if(listener.pendingConnection) {
			listener.pendingConnection!.resolve(soInit(socket));
			listener.pendingConnection = null;
		} else {
			listener.sockets.push(socket);
		}
	});
	
	return listener;
}

function soListen(address: {host: string; port: number}): TCPListener {
	const server = net.createServer({
		pauseOnConnect: true,
		noDelay: true,
	});
	
	let listener = connInit(server);
	server.listen(address, ()=> {console.log("Listening\n")});
	
	return listener;
}

function soAccept(listener: TCPListener): Promise<TCPConn> {
	console.assert(!listener.pendingConnection);
	
	return new Promise<TCPConn>((resolve, reject)=> {
	
		if(listener.err) {
			reject(listener.err);
			return;
		}
		
		if(listener.closed) {
			reject(new Error("Server closed before connection was accepted")); 
		}
	
		if(listener.sockets.length > 0) {
			let socket = listener.sockets.shift();
			resolve(soInit(socket!));
			return;
		}
		
		listener.pendingConnection = {
			resolve: resolve,
			reject: reject
		}
	});
}


let listener = soListen({
	host: '127.0.0.1',
	port: 1234,
});

async function acceptLoop(listener: TCPListener) {
	while(true) {
		try{
			let conn = await soAccept(listener);
			console.log("Connected: ", conn.socket.remoteAddress, ":", conn.socket.remotePort);
			newConn(conn);
		} catch(err) {
			console.error(err);
			break;
		}
	}
}

acceptLoop(listener);
