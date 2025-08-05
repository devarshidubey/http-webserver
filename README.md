# TS-HTTP Server (Built From Scratch, Like Literally)

Welcome to the most ✨extra✨ HTTP/1.1 server you never knew you needed: coded in **TypeScript**, powered by raw **TCP sockets**. No `http` module, no frameworks, just bare metal Node.js and vibes.

Built for modern browsers. RFC 9110 compliant (fr, no clickbait). Handles streaming, downloads, compression, and caching like a champ.

---

## Features That Slap

-  **[RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) Compliant** (followed for most things though liberal in some functionalities)
-  **Backpressure Producer-Consumer**: Promise-based I/O naturally enforces backpressure, much like blocking I/O in other languages but without actually blocking, as Node.js doesn’t support true blocking I/O. So the callback based async read, write functions of the net module are converted to promise based read/write: clean af!
-  **Static file server**: HTML, CSS, JS, videos, images all MIME-typed up
-  **Range request support**: Yup, even multipart downloads
-  **Gzip compression**: Only when it makes sense
-  **Streaming support**: Custom generators, live responses
-  **Proper error handling**: No more mystery 500s for the most part :)
-  **Built with security in mind** 
-  **Caching & ETag support**: Because bandwidth ain't free

---

## What’s Under the Hood

### TCP Layer
- `TCPConn`: A neat async wrapper around `net.Socket`
- `TCPListener`: Connection acceptor built on `net.createServer`

### Dynamic Buffers
- Custom `DynBuf` for smooth byte stream slicing and dicing
### Resouce management inspired by C
Taking a page from C’s manual memory management playbook, the resources, namely open file descriptors, are gracefully handled to prevent memory leaks. Garbage collector ain't gonna close open file sockets :(

- Clear ownership: Sockets and files have well-defined lifetimes and a single owner at a time.
- Ownership transfer: Once an fd is passed to a handler, it’s their problem now (no double frees, no leaks).
- Graceful failure: Even in bad requests or client drop-offs, the cleanup logic kicks in like a bro.



### HTTP Parser
- Parses request line, headers, body with strict validation.
- Handles chunked encoding & malformed input like a pro.

### Routing
- `/` : `home.html`
- `/echo` : echoes back whatever you throw at it
- `/files/:filename` : secure static file serving
- `/sheep` : async streaming via `countSheep()`, just for fun 🐑

### Response Engine
- Builds full HTTP responses with proper headers
- Supports chunked transfer and streaming content

### Compression
- Applies Gzip if `Accept-Encoding` allows and the content is worth it

### File Server Extras
- Safe path handling
- Full Range request support (single + multi)
- ETag generation & validation
- `If-None-Match`, `If-Range` support

---

## Tested With:
✅ Chrome  
✅ Firefox  
✅ Safari  
✅ cURL  
✅ Netcat  
✅ AI generated test code

---

## How do you run it?
Just clone the repo and the run the following command inside the directory:
```
npx tsc
node dst/index.js
```
You can use your browser to test it at: localhost/8080 or use netcat or curl(super useful)
## 🔗 Check it out
The server is deployed on Raspberry Pi 4B, have a look: [Deployed Server](https://cv.devarshidubey.com)

---

Made with 🧠, patience, and way too much caffine. And obviously with the help of these kind souls:

https://dev.to/osmanmrtacar/simple-http-server-using-nodejs-net-module-5aoa

[Build Your Own Web Server From Scratch In Node.JS by James Smith](https://leanpub.com/byo_web_server/) - for all the theory and design considerations
