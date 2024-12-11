/**
 * @module Encoder
 */
import { Hints, Segment } from './utils/encoder';
import { Encoded } from './Encoded';
import { TextEncode } from '/common/encoding';
export interface Options {
  /**
   * @property hints
   * @description Encode hints.
   */
  hints?: Hints;
  /**
   * @property encode
   * @description Text encode function.
   */
  encode?: TextEncode;
  /**
   * @property level
   * @description Error correction level.
   */
  version?: 'Auto' | number;
  /**
   * @property level
   * @description Error correction level.
   */
  level?: 'L' | 'M' | 'Q' | 'H';
}
export declare class Encoder {
  #private;
  /**
   * @constructor
   * @param options The options of encoder.
   */
  constructor({ hints, level, version, encode }?: Options);
  /**
   * @method encode
   * @description Encode the segments.
   * @param segments The segments.
   */
  encode(...segments: Segment[]): Encoded;
}
