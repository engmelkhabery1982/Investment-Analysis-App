import { DecimalType, Currency } from './common.js';
export type { Currency } from './common.js';
export interface FXRate {
    date: Date;
    baseCurrency: Currency;
    quoteCurrency: Currency;
    bid: DecimalType;
    ask: DecimalType;
    source?: string;
}
export interface FXRateRecord extends FXRate {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare function createFXRate(date: Date, baseCurrency: Currency, quoteCurrency: Currency, bid: DecimalType, ask: DecimalType, source?: string): FXRate;
export declare function validateFXRate(rate: FXRate): string[];
export declare function getSpread(rate: FXRate): DecimalType;
export declare function getSpreadPercentage(rate: FXRate): DecimalType;
export declare function invertRate(rate: FXRate): FXRate;
export declare function convertCurrency(amount: DecimalType, rate: FXRate, direction: 'base-to-quote' | 'quote-to-base', side: 'bid' | 'ask'): DecimalType;
export declare function getPairKey(base: Currency, quote: Currency): string;
//# sourceMappingURL=fx.d.ts.map