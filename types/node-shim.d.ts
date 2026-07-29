declare module 'node:zlib' {
  export function deflateSync(data: Uint8Array, options?: { level?: number }): Uint8Array;
}

type NodeBufferLike = Uint8Array & {
  toString(encoding?: string): string;
};

declare const Buffer: {
  from(data: string | Uint8Array | ArrayBuffer, encoding?: string): NodeBufferLike;
  concat(items: readonly Uint8Array[]): NodeBufferLike;
  alloc(size: number): NodeBufferLike;
};
