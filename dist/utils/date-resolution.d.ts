import { Decimal } from 'decimal.js';
import { DateResolutionPolicy, DateResolutionResult } from '../domain/common.js';
export interface MarketDataPoint<T> {
    date: Date;
    value: T;
}
export declare function resolveDate<T>(requestedDate: Date, availableDates: Date[], policy: DateResolutionPolicy): Date;
export declare function resolveMarketData<T>(requestedDate: Date, dataPoints: MarketDataPoint<T>[], policy: DateResolutionPolicy, dateExtractor: (point: MarketDataPoint<T>) => Date): DateResolutionResult<T>;
export declare function createDateResolver<T>(dataPoints: MarketDataPoint<T>[], dateExtractor: (point: MarketDataPoint<T>) => Date, defaultPolicy?: DateResolutionPolicy): {
    resolve: (requestedDate: Date, policy?: DateResolutionPolicy) => DateResolutionResult<T>;
    resolveOrThrow: (requestedDate: Date, policy?: DateResolutionPolicy) => T;
    getAvailableDates: () => Date[];
    hasExactDate: (date: Date) => boolean;
};
export declare function validateDateOrder(paymentDate: Date, valuationDate: Date): void;
export declare function validatePositiveRate(rate: Decimal, name: string): void;
export declare function validateNonZeroAmount(amount: Decimal, name: string): void;
//# sourceMappingURL=date-resolution.d.ts.map