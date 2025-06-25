export type HTTPReq = {
	method: string;
	uri: Buffer;
	version: string;
	headers: Map<string, Buffer[]>;
}

export type HTTPRes = {
	version: string;
	status_code: number;
	reason: null | string;
	headers:  Map<string, Buffer[]>;
	body: BodyReader;
}

export type BodyReader = {
	length : number;
	read: () => Promise<Buffer>; //read data
	close?: () => Promise<void>;
}

export class HTTPError extends Error {
    code: number;
	reason: string;
    constructor(code: number, reason: string, message: string) {
        super(message);
        this.name = "HTTPError";
        this.code = code;
		this.reason = reason;
    }
}
