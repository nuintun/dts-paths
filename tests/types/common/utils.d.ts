/**
 * @module utils
 */
export declare function toBit(value: number): 0 | 1;
export declare function toInt32(value: number): number;
export declare function round(value: number): number;
export declare function getBitMask(value: number): number;
export declare function getBitOffset(value: number): number;
export declare function charAt(value: string, index: number): string;
export declare function hammingWeight(value: number): number;
export declare function findMSBSet(value: number): number;
export declare function calculateBCHCode(value: number, poly: number): number;
export declare function accumulate(array: ArrayLike<number>, start?: number, end?: number): number;
