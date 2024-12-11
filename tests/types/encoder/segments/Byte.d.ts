/**
 * @module Byte
 */
import { Mode } from '/common/Mode';
import { Charset } from '/common/Charset';
import { BitArray } from '/common/BitArray';
import { TextEncode } from '/common/encoding';
export declare class Byte {
  #private;
  /**
   * @constructor
   * @param content The content to encode.
   * @param charset The charset of the content.
   */
  constructor(content: string, charset?: Charset);
  /**
   * @property mode
   * @description The mode of the segment.
   */
  get mode(): Mode;
  /**
   * @property content
   * @description The content of the segment.
   */
  get content(): string;
  /**
   * @property charset
   * @description The charset of the content.
   */
  get charset(): Charset;
  /**
   * @method encode
   * @description Encode the segment.
   * @param encode The text encode function.
   */
  encode(encode: TextEncode): BitArray;
}
