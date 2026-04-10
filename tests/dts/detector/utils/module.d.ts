/**
 * @module module
 */
import { Pattern } from '/detector/Pattern';
import { BitMatrix } from '/common/BitMatrix';
export type ModuleSizeGroup = readonly [x: number, y: number];
export declare function calculateModuleSizeOneWay(matrix: BitMatrix, pattern1: Pattern, pattern2: Pattern): number;
