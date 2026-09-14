import { DecimalType, Currency, Money, normalizeDate } from './common.js';
import { CashFlow } from './cashflow.js';
import { GoldPrice } from './gold.js';
import { FXRate } from './fx.js';
import { CPIRecord } from './cpi.js';
import { Decimal } from 'decimal.js';

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

export function createGoldPurchaseTrace(
  paymentId: string,
  paymentDate: Date,
  paymentAmount: DecimalType,
  goldAskPrice: DecimalType,
  goldAskDate: Date,
  goldQuantity: DecimalType,
  valuationDate: Date,
  goldBidPrice: DecimalType,
  goldBidDate: Date,
  liquidationValue: DecimalType,
  dateResolutionPolicy: string
): GoldPurchaseTrace {
  return {
    paymentId,
    paymentDate: normalizeDate(paymentDate),
    paymentAmount,
    goldAskPrice,
    goldAskDate: normalizeDate(goldAskDate),
    goldQuantity,
    valuationDate: normalizeDate(valuationDate),
    goldBidPrice,
    goldBidDate: normalizeDate(goldBidDate),
    liquidationValue,
    dateResolutionPolicy,
  };
}

export function createCurrencyPurchaseTrace(
  paymentId: string,
  paymentDate: Date,
  paymentAmount: DecimalType,
  paymentCurrency: Currency,
  fxAskRate: DecimalType,
  fxAskDate: Date,
  targetCurrency: Currency,
  currencyUnits: DecimalType,
  valuationDate: Date,
  fxBidRate: DecimalType,
  fxBidDate: Date,
  liquidationValue: DecimalType,
  dateResolutionPolicy: string
): CurrencyPurchaseTrace {
  return {
    paymentId,
    paymentDate: normalizeDate(paymentDate),
    paymentAmount,
    paymentCurrency,
    fxAskRate,
    fxAskDate: normalizeDate(fxAskDate),
    targetCurrency,
    currencyUnits,
    valuationDate: normalizeDate(valuationDate),
    fxBidRate,
    fxBidDate: normalizeDate(fxBidDate),
    liquidationValue,
    dateResolutionPolicy,
  };
}

export function createInflationAdjustmentTrace(
  paymentId: string,
  paymentDate: Date,
  paymentAmount: DecimalType,
  cpiAtPayment: DecimalType,
  cpiAtPaymentDate: Date,
  cpiAtValuation: DecimalType,
  cpiAtValuationDate: Date,
  inflationFactor: DecimalType,
  adjustedValue: DecimalType,
  dateResolutionPolicy: string
): InflationAdjustmentTrace {
  return {
    paymentId,
    paymentDate: normalizeDate(paymentDate),
    paymentAmount,
    cpiAtPayment,
    cpiAtPaymentDate: normalizeDate(cpiAtPaymentDate),
    cpiAtValuation,
    cpiAtValuationDate: normalizeDate(cpiAtValuationDate),
    inflationFactor,
    adjustedValue,
    dateResolutionPolicy,
  };
}

export function calculateAbsoluteGainLoss(
  currentValue: DecimalType,
  totalInvested: DecimalType
): DecimalType {
  return currentValue.minus(totalInvested);
}

export function calculatePercentageReturn(
  currentValue: DecimalType,
  totalInvested: DecimalType
): DecimalType {
  if (totalInvested.isZero()) {
    return new Decimal(0);
  }
  return currentValue.minus(totalInvested).div(totalInvested).times(100);
}

export function calculateAnnualizedReturn(
  percentageReturn: DecimalType,
  years: DecimalType
): DecimalType {
  if (years.lte(0)) {
    throw new Error('Years must be positive for annualized return');
  }
  const one = new Decimal(1);
  const base = one.plus(percentageReturn.div(100));
  return base.pow(one.div(years)).minus(one).times(100);
}

export function createAlternativeInvestmentResult(
  investmentId: string,
  investmentName: string,
  assetClass: string,
  totalInvested: DecimalType,
  totalInvestedCurrency: Currency,
  currentValue: DecimalType,
  currentValueCurrency: Currency,
  valuationDate: Date,
  options?: {
    xirr?: XIRRResult;
    traces?: AlternativeInvestmentResult['traces'];
    metadata?: Record<string, unknown>;
  }
): AlternativeInvestmentResult {
  const absoluteGainLoss = calculateAbsoluteGainLoss(currentValue, totalInvested);
  const percentageReturn = calculatePercentageReturn(currentValue, totalInvested);
  
  let annualizedReturn: DecimalType | undefined;
  if (options?.xirr?.converged && options.xirr.rate.gt(0)) {
    annualizedReturn = options.xirr.rate.times(100);
  }
  
  return {
    investmentId,
    investmentName,
    assetClass,
    totalInvested,
    totalInvestedCurrency,
    currentValue,
    currentValueCurrency,
    absoluteGainLoss,
    percentageReturn,
    annualizedReturn,
    xirr: options?.xirr,
    valuationDate: normalizeDate(valuationDate),
    traces: options?.traces || {},
    metadata: options?.metadata,
  };
}

export function createInvestmentComparisonResult(
  baseInvestment: AlternativeInvestmentResult,
  alternatives: AlternativeInvestmentResult[],
  baseCurrency: Currency,
  valuationDate: Date
): InvestmentComparisonResult {
  const sorted = [...alternatives].sort((a, b) => 
    b.percentageReturn.minus(a.percentageReturn).toNumber()
  );
  
  const bestAlternative = sorted[0]?.investmentName || 'None';
  const worstAlternative = sorted[sorted.length - 1]?.investmentName || 'None';
  
  const bestValue = sorted[0]?.currentValue || new Decimal(0);
  const opportunityCost = bestValue.minus(baseInvestment.currentValue);
  
  return {
    baseInvestment,
    alternatives: sorted,
    valuationDate: normalizeDate(valuationDate),
    baseCurrency,
    summary: {
      bestAlternative,
      worstAlternative,
      opportunityCost,
      opportunityCostCurrency: baseCurrency,
    },
  };
}