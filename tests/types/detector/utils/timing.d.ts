/**
 * @module timing
 */
import { BitMatrix } from '/common/BitMatrix';
import { FinderPatternGroup } from '/detector/FinderPatternGroup';
import { PerspectiveTransform } from '/common/PerspectiveTransform';
export declare function checkEstimateTimingLine(
  matrix: BitMatrix,
  finderPatternGroup: FinderPatternGroup,
  isVertical?: boolean
): boolean;
export declare function checkMappingTimingLine(
  matrix: BitMatrix,
  transform: PerspectiveTransform,
  size: number,
  isVertical?: boolean
): boolean;
