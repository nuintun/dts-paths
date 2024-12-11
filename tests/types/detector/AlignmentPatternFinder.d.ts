/**
 * @module AlignmentPatternFinder
 */
import { Pattern } from './Pattern';
import { BitMatrix } from '/common/BitMatrix';
import { PatternFinder } from './PatternFinder';
export declare class AlignmentPatternFinder extends PatternFinder {
  constructor(matrix: BitMatrix, strict?: boolean);
  filter(expectAlignment: Pattern, moduleSize: number): Pattern[];
  find(left: number, top: number, width: number, height: number): void;
}
