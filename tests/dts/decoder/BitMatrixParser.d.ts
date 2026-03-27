/**
 * @module BitMatrixParser
 */
import { ECLevel } from '/common/ECLevel';
import { BitMatrix } from '/common/BitMatrix';
import { FormatInfo } from './FormatInfo';
import { Version } from '/common/Version';
export declare class BitMatrixParser {
  #private;
  constructor(matrix: BitMatrix);
  readVersion(): Version;
  readFormatInfo(): FormatInfo;
  readCodewords(version: Version, ecLevel: ECLevel): Uint8Array;
  unmask(mask: number): void;
  remask(mask: number): void;
  mirror(): void;
}
