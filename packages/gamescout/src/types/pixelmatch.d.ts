declare module 'pixelmatch' {
  export default function pixelmatch(
    img1: Buffer | Uint8Array,
    img2: Buffer | Uint8Array,
    output: Buffer | Uint8Array,
    width: number,
    height: number,
    options?: { threshold?: number }
  ): number;
}
