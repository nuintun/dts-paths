/**
 * @module FinderPatternFinder
 */
import { BitMatrix } from '/common/BitMatrix';
import { PatternFinder } from './PatternFinder';
import { FinderPatternGroup } from './FinderPatternGroup';
export declare class FinderPatternFinder extends PatternFinder {
  constructor(matrix: BitMatrix, strict?: boolean);
  groups(): Generator<FinderPatternGroup, void, boolean>;
  find(left: number, top: number, width: number, height: number): void;
}
