// Cloudflare TCP 소켓(cloudflare:sockets) 타입: 메일 받기·보내기에 쓰는 만큼만
declare module 'cloudflare:sockets' {
  interface Socket { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array>; close(): Promise<void>; closed: Promise<void> }
  export function connect(address: { hostname: string; port: number }, options?: { secureTransport?: 'off' | 'on' | 'starttls'; allowHalfOpen?: boolean }): Socket;
}
