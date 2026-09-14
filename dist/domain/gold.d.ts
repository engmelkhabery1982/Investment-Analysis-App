import { DecimalType } from './common.js';
export interface GoldPrice {
    date: Date;
    bid: DecimalType;
    ask: DecimalType;
    currency: 'EGP';
    unit: 'gram' | 'ounce' | 'kilogram';
    source?: string;
}
export interface GoldPriceRecord extends GoldPrice {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare function createGoldPrice(date: Date, bid: DecimalType, ask: DecimalType, unit?: 'gram' | 'ounce' | 'kilogram', source?: string): GoldPrice;
export declare function validateGoldPrice(price: GoldPrice): string[];
export declare function getSpread(price: GoldPrice): DecimalType;
export declare function getSpreadPercentage(price: GoldPrice): DecimalType;
export declare function convertGoldUnit(price: GoldPrice, targetUnit: 'gram' | 'ounce' | 'kilogram'): GoldPrice;
//# sourceMappingURL=gold.d.ts.map