/**
 * @module matrix
 */
import { ECLevel } from '/common/ECLevel';
import { BitArray } from '/common/BitArray';
import { ByteMatrix } from '/common/ByteMatrix';
import { Version } from '/common/Version';
export declare function buildMatrix(codewords: BitArray, version: Version, ecLevel: ECLevel, mask: number): ByteMatrix;
