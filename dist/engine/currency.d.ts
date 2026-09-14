import { DecimalType, Currency } from '../domain/common.js';
import { FXRate } from '../domain/fx.js';
import { CashFlow } from '../domain/cashflow.js';
import { CurrencyPurchaseTrace } from '../domain/results.js';
import { DateResolutionPolicy } from '../domain/common.js';
export interface CurrencyCalculationOptions {
    dateResolutionPolicy: DateResolutionPolicy;
    targetCurrency: Currency;
}
export interface CurrencyCalculationResult {
    totalCurrencyUnits: DecimalType;
    totalInvested: DecimalType;
    liquidationValue: DecimalType;
    absoluteGainLoss: DecimalType;
    percentageReturn: DecimalType;
    traces: CurrencyPurchaseTrace[];
}
export declare function calculateCurrencyUnits(paymentAmount: DecimalType, fxAskRate: DecimalType): DecimalType;
export declare function calculateCurrencyLiquidationValue(totalCurrencyUnits: DecimalType, fxBidRate: DecimalType): DecimalType;
export declare function calculateCurrencyInvestment(cashFlows: CashFlow[], fxRates: FXRate[], valuationDate: Date, options: CurrencyCalculationOptions): CurrencyCalculationResult;
export declare function convertCurrencyAmount(amount: DecimalType, rate: FXRate, direction: 'base-to-quote' | 'quote-to-base', side: 'bid' | 'ask'): DecimalType;
//# sourceMappingURL=currency.d.ts.map