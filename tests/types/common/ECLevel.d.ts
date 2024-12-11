/**
 * @module ECLevel
 */
export declare function fromECLevelBits(bits: number): ECLevel;
export declare class ECLevel {
  #private;
  static readonly L: ECLevel;
  static readonly M: ECLevel;
  static readonly Q: ECLevel;
  static readonly H: ECLevel;
  constructor(name: string, level: number, bits: number);
  get bits(): number;
  get name(): string;
  get level(): number;
}
