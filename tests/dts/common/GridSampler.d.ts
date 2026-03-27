/**
 * @module GridSampler
 */
import { BitMatrix } from './BitMatrix';
import { PerspectiveTransform } from './PerspectiveTransform';
export declare class GridSampler {
  #private;
  constructor(matrix: BitMatrix, transform: PerspectiveTransform);
  sample(width: number, height: number): BitMatrix;
}
