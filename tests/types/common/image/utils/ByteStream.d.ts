/**
 * @module ByteStream
 */
export declare class ByteStream {
  #private;
  get bytes(): number[];
  writeByte(value: number): void;
  writeInt16(value: number): void;
  writeBytes(bytes: number[], offset?: number, length?: number): void;
}
