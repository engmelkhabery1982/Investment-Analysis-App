import { DecimalType, Currency } from './common.js';
export interface GoldPurchaseTrace {
    paymentId: string;
    paymentDate: Date;
    paymentAmount: DecimalType;
    goldAskPrice: DecimalType;
    goldAskDate: Date;
    goldQuantity: DecimalType;
    valuationDate: Date;
    goldBidPrice: DecimalType;
    goldBidDate: Date;
    liquidationValue: DecimalType;
    dateResolutionPolicy: string;
}
export interface CurrencyPurchaseTrace {
    paymentId: string;
    paymentDate: Date;
    paymentAmount: DecimalType;
    paymentCurrency: Currency;
    fxAskRate: DecimalType;
    fxAskDate: Date;
    targetCurrency: Currency;
    currencyUnits: DecimalType;
    valuationDate: Date;
    fxBidRate: DecimalType;
    fxBidDate: Date;
    liquidationValue: DecimalType;
    dateResolutionPolicy: string;
}
export interface InflationAdjustmentTrace {
    paymentId: string;
    paymentDate: Date;
    paymentAmount: DecimalType;
    cpiAtPayment: DecimalType;
    cpiAtPaymentDate: Date;
    cpiAtValuation: DecimalType;
    cpiAtValuationDate: Date;
    inflationFactor: DecimalType;
    adjustedValue: DecimalType;
    dateResolutionPolicy: string;
}
export interface XIRRInput {
    date: Date;
    amount: DecimalType;
}
export interface XIRRResult {
    rate: DecimalType;
    iterations: number;
    converged: boolean;
    error?: string;
}
export interface XNPVResult {
    value: DecimalType;
    rate: DecimalType;
}
export interface AlternativeInvestmentResult {
    investmentId: string;
    investmentName: string;
    assetClass: string;
    totalInvested: DecimalType;
    totalInvestedCurrency: Currency;
    currentValue: DecimalType;
    currentValueCurrency: Currency;
    absoluteGainLoss: DecimalType;
    percentageReturn: DecimalType;
    annualizedReturn?: DecimalType;
    xirr?: XIRRResult;
    valuationDate: Date;
    traces: {
        gold?: GoldPurchaseTrace[];
        currency?: CurrencyPurchaseTrace[];
        inflation?: InflationAdjustmentTrace[];
    };
    metadata?: Record<string, unknown>;
}
export interface InvestmentComparisonResult {
    baseInvestment: AlternativeInvestmentResult;
    alternatives: AlternativeInvestmentResult[];
    valuationDate: Date;
    baseCurrency: Currency;
    summary: {
        bestAlternative: string;
        worstAlternative: string;
        opportunityCost: DecimalType;
        opportunityCostCurrency: Currency;
    };
}
export declare function createGoldPurchaseTrace(paymentId: string, paymentDate: Date, paymentAmount: DecimalType, goldAskPrice: DecimalType, goldAskDate: Date, goldQuantity: DecimalType, valuationDate: Date, goldBidPrice: DecimalType, goldBidDate: Date, liquidationValue: DecimalType, dateResolutionPolicy: string): GoldPurchaseTrace;
export declare function createCurrencyPurchaseTrace(paymentId: string, paymentDate: Date, paymentAmount: DecimalType, paymentCurrency: Currency, fxAskRate: DecimalType, fxAskDate: Date, targetCurrency: Currency, currencyUnits: DecimalType, valuationDate: Date, fxBidRate: DecimalType, fxBidDate: Date, liquidationValue: DecimalType, dateResolutionPolicy: string): CurrencyPurchaseTrace;
export declare function createInflationAdjustmentTrace(paymentId: string, paymentDate: Date, paymentAmount: DecimalType, cpiAtPayment: DecimalType, cpiAtPaymentDate: Date, cpiAtValuation: DecimalType, cpiAtValuationDate: Date, inflationFactor: DecimalType, adjustedValue: DecimalType, dateResolutionPolicy: string): InflationAdjustmentTrace;
export declare function calculateAbsoluteGainLoss(currentValue: DecimalType, totalInvested: DecimalType): DecimalType;
export declare function calculatePercentageReturn(currentValue: DecimalType, totalInvested: DecimalType): DecimalType;
export declare function calculateAnnualizedReturn(percentageReturn: DecimalType, years: DecimalType): DecimalType;
export declare function createAlternativeInvestmentResult(investmentId: string, investmentName: string, assetClass: string, totalInvested: DecimalType, totalInvestedCurrency: Currency, currentValue: DecimalType, currentValueCurrency: Currency, valuationDate: Date, options?: {
    xirr?: XIRRResult;
    traces?: AlternativeInvestmentResult['traces'];
    metadata?: Record<string, unknown>;
}): AlternativeInvestmentResult;
export declare function createInvestmentComparisonResult(baseInvestment: AlternativeInvestmentResult, alternatives: AlternativeInvestmentResult[], baseCurrency: Currency, valuationDate: Date): InvestmentComparisonResult;
//# sourceMappingURL=results.d.ts.map