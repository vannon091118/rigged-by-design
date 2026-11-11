declare module 'pngjs' {
  export class PNG {
    width: number;
    height: number;
    data: Buffer;
    constructor(options?: { width?: number; height?: number });
    static sync: { read(buffer: Buffer | Uint8Array): PNG };
    static read(buffer: Buffer | Uint8Array): PNG;
    static write(png: PNG, options?: Record<string, unknown>): Buffer;
    pack(): Buffer;
    parse(data: string | Buffer): void;
  }
}
