import { Decimal } from 'decimal.js';
export type DateResolutionPolicy = 'exact' | 'previous' | 'nearest';
export interface DateResolutionResult<T> {
    value: T;
    sourceDate: Date;
    requestedDate: Date;
    policy: DateResolutionPolicy;
}
export type Currency = 'EGP' | 'USD' | 'EUR' | 'GBP';
export type AssetClass = 'real-estate' | 'gold' | 'currency' | 'inflation-indexed' | 'custom';
export type DecimalType = Decimal;
export interface Money {
    amount: DecimalType;
    currency: Currency;
}
export interface DateRange {
    start: Date;
    end: Date;
}
export declare function isValidDate(date: unknown): date is Date;
export declare function normalizeDate(date: Date): Date;
export declare function daysBetween(start: Date, end: Date): number;
export declare function yearsBetween(start: Date, end: Date): DecimalType;
//# sourceMappingURL=common.d.ts.map