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
Object.defineProperty(exports, "__esModule", { value: true });
const net = __importStar(require("net"));
class RFCCompliantHTTPClient {
    constructor(options) {
        this.options = options;
        this.socket = null;
        this.connectionPromise = null;
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.socket && !this.socket.destroyed) {
                return this.socket;
            }
            if (!this.connectionPromise) {
                this.connectionPromise = new Promise((resolve, reject) => {
                    const socket = net.createConnection({
                        host: this.options.host,
                        port: this.options.port,
                    });
                    socket.on('connect', () => {
                        this.socket = socket;
                        this.connectionPromise = null;
                        resolve(socket);
                    });
                    socket.on('error', (err) => {
                        this.connectionPromise = null;
                        reject(err);
                    });
                    if (this.options.timeout) {
                        socket.setTimeout(this.options.timeout);
                    }
                });
            }
            return this.connectionPromise;
        });
    }
    request(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const socket = yield this.connect();
            // Craft RFC-compliant HTTP/1.1 request
            const request = [
                `GET ${path} HTTP/1.1`,
                `Host: ${this.options.host}:${this.options.port}`,
                `Connection: ${this.options.keepAlive ? 'keep-alive' : 'close'}`,
                'User-Agent: RFCCompliantHTTPClient/1.0',
                'If-None-Match: "25557-1750705642118.8445"',
                '\r\n'
            ].join('\r\n');
            return new Promise((resolve, reject) => {
                // Response handler
                const onData = (data) => {
                    console.log(`Received:\n${data.toString()}`);
                    // Proper response consumption
                    if (data.toString().includes('\r\n\r\n')) {
                        // Headers received, now drain the body if needed
                        socket.off('data', onData);
                        resolve();
                    }
                };
                socket.on('data', onData);
                socket.on('error', reject);
                socket.on('timeout', () => reject(new Error('Request timeout')));
                socket.write(request, (err) => {
                    if (err)
                        reject(err);
                });
            });
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.socket) {
                // Graceful FIN (half-close)
                this.socket.end();
                yield new Promise((resolve) => { var _a; return (_a = this.socket) === null || _a === void 0 ? void 0 : _a.on('close', resolve); });
            }
        });
    }
}
// Usage Example
(() => __awaiter(void 0, void 0, void 0, function* () {
    const client = new RFCCompliantHTTPClient({
        host: 'localhost',
        port: 1234,
        keepAlive: true,
        timeout: 5000
    });
    try {
        // First request (reuses connection)
        // await client.request('/');
        //console.log('First request completed');
        // Wait 2 seconds (simulates idle time)
        // await setTimeout(5000);
        // Second request (same connection if keepAlive)
        yield client.request('/files/test_read');
        console.log('Second request completed');
    }
    finally {
        // Proper connection teardown
        yield client.close();
        console.log('Connection closed');
    }
}))();
