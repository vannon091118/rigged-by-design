declare class Buffer {
  static from(data: string | ArrayBuffer | Buffer, encoding?: string): Buffer;
  toString(encoding?: string): string;
}
