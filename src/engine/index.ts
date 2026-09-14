import { Decimal } from 'decimal.js';
import { Investment, CashFlow, Currency, AssetClass } from '../domain/index.js';
import { GoldPrice, FXRate, CPIRecord } from '../domain/index.js';
import { 
  AlternativeInvestmentResult, 
  InvestmentComparisonResult,
  createAlternativeInvestmentResult,
  createInvestmentComparisonResult,
} from '../domain/results.js';
import { GoldCalculationOptions, calculateGoldInvestment } from './gold.js';
import { CurrencyCalculationOptions, calculateCurrencyInvestment } from './currency.js';
import { InflationCalculationOptions, calculateInflationAdjustedInvestment } from './inflation.js';
import { calculateXIRRFromCashFlows, XIRROptions } from './xirr.js';
import { DateResolutionPolicy } from '../domain/common.js';

export interface CalculationEngineOptions {
  dateResolutionPolicy: DateResolutionPolicy;
  xirrOptions?: XIRROptions;
}

export class CalculationEngine {
  private goldPrices: GoldPrice[] = [];
  private fxRates: FXRate[] = [];
  private cpiRecords: CPIRecord[] = [];
  private options: CalculationEngineOptions;
  
  constructor(options: CalculationEngineOptions) {
    this.options = options;
  }
  
  setGoldPrices(prices: GoldPrice[]): void {
    this.goldPrices = [...prices].sort((a, b) => a.date.getTime() - b.date.getTime());
  }
  
  setFXRates(rates: FXRate[]): void {
    this.fxRates = [...rates].sort((a, b) => a.date.getTime() - b.date.getTime());
  }
  
  setCPIRecords(records: CPIRecord[]): void {
    this.cpiRecords = [...records].sort((a, b) => a.date.getTime() - b.date.getTime());
  }
  
  getGoldPrices(): GoldPrice[] {
    return [...this.goldPrices];
  }
  
  getFXRates(): FXRate[] {
    return [...this.fxRates];
  }
  
  getCPIRecords(): CPIRecord[] {
    return [...this.cpiRecords];
  }
  
  calculateGoldAlternative(
    investment: Investment,
    valuationDate: Date
  ): AlternativeInvestmentResult {
    const goldOptions: GoldCalculationOptions = {
      dateResolutionPolicy: this.options.dateResolutionPolicy,
      goldUnit: 'gram',
    };
    
    const result = calculateGoldInvestment(
      investment.cashFlows,
      this.goldPrices,
      valuationDate,
      goldOptions
    );
    
    const xirr = calculateXIRRFromCashFlows(investment.cashFlows, this.options.xirrOptions);
    
    return createAlternativeInvestmentResult(
      investment.id,
      investment.name,
      'gold',
      result.totalInvested,
      'EGP',
      result.liquidationValue,
      'EGP',
      valuationDate,
      {
        xirr,
        traces: { gold: result.traces },
      }
    );
  }
  
  calculateCurrencyAlternative(
    investment: Investment,
    targetCurrency: Currency,
    valuationDate: Date
  ): AlternativeInvestmentResult {
    const currencyOptions: CurrencyCalculationOptions = {
      dateResolutionPolicy: this.options.dateResolutionPolicy,
      targetCurrency,
    };
    
    const result = calculateCurrencyInvestment(
      investment.cashFlows,
      this.fxRates,
      valuationDate,
      currencyOptions
    );
    
    const xirr = calculateXIRRFromCashFlows(investment.cashFlows, this.options.xirrOptions);
    
    return createAlternativeInvestmentResult(
      investment.id,
      investment.name,
      'currency',
      result.totalInvested,
      investment.currency,
      result.liquidationValue,
      investment.currency,
      valuationDate,
      {
        xirr,
        traces: { currency: result.traces },
      }
    );
  }
  
  calculateInflationAlternative(
    investment: Investment,
    valuationDate: Date
  ): AlternativeInvestmentResult {
    const inflationOptions: InflationCalculationOptions = {
      dateResolutionPolicy: this.options.dateResolutionPolicy,
    };
    
    const result = calculateInflationAdjustedInvestment(
      investment.cashFlows,
      this.cpiRecords,
      valuationDate,
      inflationOptions
    );
    
    const xirr = calculateXIRRFromCashFlows(investment.cashFlows, this.options.xirrOptions);
    
    return createAlternativeInvestmentResult(
      investment.id,
      investment.name,
      'inflation-indexed',
      result.totalInvested,
      'EGP',
      result.totalAdjustedValue,
      'EGP',
      valuationDate,
      {
        xirr,
        traces: { inflation: result.traces },
      }
    );
  }
  
  calculateRealEstateBase(
    investment: Investment,
    currentPropertyValue: Decimal,
    valuationDate: Date
  ): AlternativeInvestmentResult {
    const totalInvested = investment.cashFlows.reduce(
      (sum, f) => sum.plus(f.amount),
      new Decimal(0)
    );
    
    const xirr = calculateXIRRFromCashFlows(investment.cashFlows, this.options.xirrOptions);
    
    return createAlternativeInvestmentResult(
      investment.id,
      investment.name,
      'real-estate',
      totalInvested,
      investment.currency,
      currentPropertyValue,
      investment.currency,
      valuationDate,
      { xirr }
    );
  }
  
  compareAlternatives(
    baseInvestment: Investment,
    currentPropertyValue: Decimal,
    targetCurrencies: Currency[],
    valuationDate: Date
  ): InvestmentComparisonResult {
    const base = this.calculateRealEstateBase(baseInvestment, currentPropertyValue, valuationDate);
    
    const alternatives: AlternativeInvestmentResult[] = [];
    
    if (this.goldPrices.length > 0) {
      alternatives.push(this.calculateGoldAlternative(baseInvestment, valuationDate));
    }
    
    for (const currency of targetCurrencies) {
      const relevantRates = this.fxRates.filter(r => 
        r.baseCurrency === baseInvestment.currency && r.quoteCurrency === currency
      );
      if (relevantRates.length > 0) {
        alternatives.push(this.calculateCurrencyAlternative(baseInvestment, currency, valuationDate));
      }
    }
    
    if (this.cpiRecords.length > 0) {
      alternatives.push(this.calculateInflationAlternative(baseInvestment, valuationDate));
    }
    
    return createInvestmentComparisonResult(
      base,
      alternatives,
      baseInvestment.currency,
      valuationDate
    );
  }
}

export function createCalculationEngine(options: CalculationEngineOptions): CalculationEngine {
  return new CalculationEngine(options);
}