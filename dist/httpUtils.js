"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTPError = void 0;
class HTTPError extends Error {
    constructor(code, reason, message) {
        super(message);
        this.name = "HTTPError";
        this.code = code;
        this.reason = reason;
    }
}
exports.HTTPError = HTTPError;
