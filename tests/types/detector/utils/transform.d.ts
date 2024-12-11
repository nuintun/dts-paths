/**
 * @module transform
 */
import { Pattern } from '/detector/Pattern';
import { FinderPatternGroup } from '/detector/FinderPatternGroup';
import { PerspectiveTransform } from '/common/PerspectiveTransform';
export declare function createTransform(
  finderPatternGroup: FinderPatternGroup,
  alignmentPattern?: Pattern
): PerspectiveTransform;
