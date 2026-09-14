import { DecimalType } from '../domain/common.js';
import { GoldPrice } from '../domain/gold.js';
import { CashFlow } from '../domain/cashflow.js';
import { GoldPurchaseTrace } from '../domain/results.js';
import { DateResolutionPolicy } from '../domain/common.js';
export interface GoldCalculationOptions {
    dateResolutionPolicy: DateResolutionPolicy;
    goldUnit: 'gram' | 'ounce' | 'kilogram';
}
export interface GoldCalculationResult {
    totalGoldQuantity: DecimalType;
    totalInvested: DecimalType;
    liquidationValue: DecimalType;
    absoluteGainLoss: DecimalType;
    percentageReturn: DecimalType;
    traces: GoldPurchaseTrace[];
}
export declare function calculateGoldQuantity(paymentAmount: DecimalType, goldAskPrice: DecimalType): DecimalType;
export declare function calculateGoldLiquidationValue(totalGoldQuantity: DecimalType, goldBidPrice: DecimalType): DecimalType;
export declare function calculateGoldInvestment(cashFlows: CashFlow[], goldPrices: GoldPrice[], valuationDate: Date, options: GoldCalculationOptions): GoldCalculationResult;
export declare function calculateGoldInvestmentSimple(payments: Array<{
    date: Date;
    amount: DecimalType;
}>, goldAskPrices: Map<string, DecimalType>, goldBidPrice: DecimalType, valuationDate: Date): {
    totalGold: DecimalType;
    totalInvested: DecimalType;
    liquidationValue: DecimalType;
};
//# sourceMappingURL=gold.d.ts.map