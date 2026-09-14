import { Decimal } from 'decimal.js';
import { Investment, Currency } from '../domain/index.js';
import { GoldPrice, FXRate, CPIRecord } from '../domain/index.js';
import { AlternativeInvestmentResult, InvestmentComparisonResult } from '../domain/results.js';
import { XIRROptions } from './xirr.js';
import { DateResolutionPolicy } from '../domain/common.js';
export interface CalculationEngineOptions {
    dateResolutionPolicy: DateResolutionPolicy;
    xirrOptions?: XIRROptions;
}
export declare class CalculationEngine {
    private goldPrices;
    private fxRates;
    private cpiRecords;
    private options;
    constructor(options: CalculationEngineOptions);
    setGoldPrices(prices: GoldPrice[]): void;
    setFXRates(rates: FXRate[]): void;
    setCPIRecords(records: CPIRecord[]): void;
    getGoldPrices(): GoldPrice[];
    getFXRates(): FXRate[];
    getCPIRecords(): CPIRecord[];
    calculateGoldAlternative(investment: Investment, valuationDate: Date): AlternativeInvestmentResult;
    calculateCurrencyAlternative(investment: Investment, targetCurrency: Currency, valuationDate: Date): AlternativeInvestmentResult;
    calculateInflationAlternative(investment: Investment, valuationDate: Date): AlternativeInvestmentResult;
    calculateRealEstateBase(investment: Investment, currentPropertyValue: Decimal, valuationDate: Date): AlternativeInvestmentResult;
    compareAlternatives(baseInvestment: Investment, currentPropertyValue: Decimal, targetCurrencies: Currency[], valuationDate: Date): InvestmentComparisonResult;
}
export declare function createCalculationEngine(options: CalculationEngineOptions): CalculationEngine;
//# sourceMappingURL=index.d.ts.map