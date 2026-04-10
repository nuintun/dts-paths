/**
 * @module decoder
 */
import { ECLevel } from '/common/ECLevel';
import { Version } from '/common/Version';
import { DataBlock } from '/decoder/DataBlock';
export declare function correctErrors(
  codewords: Uint8Array,
  numDataCodewords: number
): [codewords: Int32Array, errorsCorrected: number];
export declare function getDataBlocks(codewords: Uint8Array, version: Version, ecLevel: ECLevel): DataBlock[];
