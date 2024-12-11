/**
 * @module Encoded
 */
import { ECLevel } from '/common/ECLevel';
import { Version } from '/common/Version';
import { ByteMatrix } from '/common/ByteMatrix';
import { Colors } from '/common/image/GIFImage';
export declare class Encoded {
  #private;
  constructor(matrix: ByteMatrix, version: Version, level: ECLevel, mask: number);
  /**
   * @property matrix
   * @description Get the size of qrcode.
   */
  get size(): number;
  /**
   * @property mask
   * @description Get the mask of qrcode.
   */
  get mask(): number;
  /**
   * @property level
   * @description Get the error correction level of qrcode.
   */
  get level(): string;
  /**
   * @property version
   * @description Get the version of qrcode.
   */
  get version(): number;
  /**
   * @method get
   * @description Get the bit value of the specified coordinate of qrcode.
   */
  get(x: number, y: number): number;
  /**
   * @method toDataURL
   * @param moduleSize The size of one qrcode module
   * @param options Set rest options of gif, like margin, foreground and background.
   */
  toDataURL(
    moduleSize?: number,
    {
      margin,
      ...colors
    }?: Colors & {
      margin?: number;
    }
  ): string;
}
