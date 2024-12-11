/**
 * @module BitArray
 */
export declare class BitArray {
  #private;
  constructor(length?: number);
  get length(): number;
  get byteLength(): number;
  set(index: number): void;
  get(index: number): number;
  xor(mask: BitArray): void;
  append(array: BitArray): void;
  append(value: number, length?: number): void;
  toUint8Array(bitOffset: number, array: Uint8Array, offset: number, byteLength: number): void;
  clear(): void;
}
