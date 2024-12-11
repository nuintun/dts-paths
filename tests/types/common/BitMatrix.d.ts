/**
 * @module BitMatrix
 */
export declare class BitMatrix {
  #private;
  /**
   * @constructor
   * @param width The width of the matrix.
   * @param height The height of the matrix.
   * @param bits The initial bits of the matrix.
   */
  constructor(width: number, height: number, bits?: Int32Array);
  /**
   * @property width
   * @description The width of the matrix.
   */
  get width(): number;
  /**
   * @property height
   * @description The height of the matrix.
   */
  get height(): number;
  /**
   * @method set
   * @description Set the bit value of the specified coordinate.
   * @param x The x coordinate.
   * @param y The y coordinate.
   */
  set(x: number, y: number): void;
  /**
   * @method get
   * @description Get the bit value of the specified coordinate.
   * @param x The x coordinate.
   * @param y The y coordinate.
   */
  get(x: number, y: number): number;
  /**
   * @method flip
   * @description Flip the bit value of the specified coordinate.
   */
  flip(): void;
  /**
   * @method flip
   * @description Flip the bit value of the specified coordinate.
   * @param x The x coordinate.
   * @param y The y coordinate.
   */
  flip(x: number, y: number): void;
  /**
   * @method clone
   * @description Clone the bit matrix.
   */
  clone(): BitMatrix;
  /**
   * @method setRegion
   * @description Set the bit value of the specified region.
   * @param left The left coordinate.
   * @param top The top coordinate.
   * @param width The width to set.
   * @param height The height to set.
   */
  setRegion(left: number, top: number, width: number, height: number): void;
}
