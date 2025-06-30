import * as net from 'net';
import { setTimeout } from 'timers/promises';

type HTTPClientOptions = {
  host: string;
  port: number;
  keepAlive: boolean;
  timeout?: number;
};

class RFCCompliantHTTPClient {
  private socket: net.Socket | null = null;
  private connectionPromise: Promise<net.Socket> | null = null;

  constructor(private options: HTTPClientOptions) {}

  async connect(): Promise<net.Socket> {
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
  }

  async request(path: string): Promise<void> {
    const socket = await this.connect();

    // Craft RFC-compliant HTTP/1.1 request
    const request = [
      `GET ${path} HTTP/1.1`,
      `Host: ${this.options.host}:${this.options.port}`,
      `Connection: ${this.options.keepAlive ? 'keep-alive' : 'close'}`,
      'User-Agent: RFCCompliantHTTPClient/1.0',
      //'If-None-Match: "25557-1750705642118.8445"',
      //'Accept-Encoding: gzip, deflate, br, zstd',
      'Range: bytes=13927644-',
      '\r\n'
    ].join('\r\n');

    return new Promise((resolve, reject) => {
      // Response handler
      const onData = (data: Buffer) => {
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
        if (err) reject(err);
      });
    });
  }

  async close(): Promise<void> {
    if (this.socket) {
      // Graceful FIN (half-close)
      this.socket.end();
      await new Promise((resolve) => this.socket?.on('close', resolve));
    }
  }
}

// Usage Example
(async () => {
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
    await client.request('/files/som.mp4');
    console.log('Second request completed');

  } finally {
    // Proper connection teardown
    await client.close();
    console.log('Connection closed');
  }
})();
