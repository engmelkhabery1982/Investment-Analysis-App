import { Decimal } from 'decimal.js';
import { DecimalType, Currency } from '../domain/common.js';
import { FXRate } from '../domain/fx.js';
import { CashFlow } from '../domain/cashflow.js';
import { 
  CurrencyPurchaseTrace, 
  createCurrencyPurchaseTrace 
} from '../domain/results.js';
import { 
  resolveMarketData, 
  validateDateOrder, 
  validatePositiveRate,
  validateNonZeroAmount,
  MarketDataPoint 
} from '../utils/date-resolution.js';
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

export function calculateCurrencyUnits(
  paymentAmount: DecimalType,
  fxAskRate: DecimalType
): DecimalType {
  validatePositiveRate(fxAskRate, 'FX Ask Rate');
  validateNonZeroAmount(paymentAmount, 'Payment Amount');
  return paymentAmount.div(fxAskRate);
}

export function calculateCurrencyLiquidationValue(
  totalCurrencyUnits: DecimalType,
  fxBidRate: DecimalType
): DecimalType {
  validatePositiveRate(fxBidRate, 'FX Bid Rate');
  validateNonZeroAmount(totalCurrencyUnits, 'Total Currency Units');
  return totalCurrencyUnits.times(fxBidRate);
}

export function calculateCurrencyInvestment(
  cashFlows: CashFlow[],
  fxRates: FXRate[],
  valuationDate: Date,
  options: CurrencyCalculationOptions
): CurrencyCalculationResult {
  if (cashFlows.length === 0) {
    throw new Error('At least one cash flow is required');
  }
  
  // Validate all cash flows use the same currency
  const firstCurrency = cashFlows[0]!.currency;
  for (const flow of cashFlows) {
    if (flow.currency !== firstCurrency) {
      throw new Error(
        `Mixed currencies detected: expected ${firstCurrency}, found ${flow.currency} in cash flow ${flow.id}`
      );
    }
  }
  
  const sortedFlows = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const sortedRates = [...fxRates].sort((a, b) => a.date.getTime() - b.date.getTime());
  
  const relevantRates = sortedRates.filter(r => 
    r.baseCurrency === firstCurrency && r.quoteCurrency === options.targetCurrency
  );
  
  if (relevantRates.length === 0) {
    throw new Error(`No FX rates found for ${firstCurrency}/${options.targetCurrency}`);
  }
  
  const traces: CurrencyPurchaseTrace[] = [];
  let totalCurrencyUnits = new Decimal(0);
  let totalInvested = new Decimal(0);
  
  const rateDataPoints: MarketDataPoint<FXRate>[] = relevantRates.map(r => ({
    date: r.date,
    value: r,
  }));
  
  for (const flow of sortedFlows) {
    validateDateOrder(flow.date, valuationDate);
    
    const askResolution = resolveMarketData(
      flow.date,
      rateDataPoints,
      options.dateResolutionPolicy,
      p => p.value.date
    );
    
    const fxAskRate = askResolution.value.ask;
    const currencyUnits = calculateCurrencyUnits(flow.amount, fxAskRate);
    
    totalCurrencyUnits = totalCurrencyUnits.plus(currencyUnits);
    totalInvested = totalInvested.plus(flow.amount);
    
    const bidResolution = resolveMarketData(
      valuationDate,
      rateDataPoints,
      options.dateResolutionPolicy,
      p => p.value.date
    );
    
    const trace = createCurrencyPurchaseTrace(
      flow.id,
      flow.date,
      flow.amount,
      flow.currency,
      fxAskRate,
      askResolution.sourceDate,
      options.targetCurrency,
      currencyUnits,
      valuationDate,
      bidResolution.value.bid,
      bidResolution.sourceDate,
      new Decimal(0),
      options.dateResolutionPolicy
    );
    
    traces.push(trace);
  }
  
  const bidResolution = resolveMarketData(
    valuationDate,
    rateDataPoints,
    options.dateResolutionPolicy,
    p => p.value.date
  );
  
  const fxBidRate = bidResolution.value.bid;
  const liquidationValue = calculateCurrencyLiquidationValue(totalCurrencyUnits, fxBidRate);
  
  const updatedTraces = traces.map(t => ({
    ...t,
    liquidationValue: t.currencyUnits.times(fxBidRate),
  }));
  
  const absoluteGainLoss = liquidationValue.minus(totalInvested);
  const percentageReturn = totalInvested.isZero() 
    ? new Decimal(0) 
    : absoluteGainLoss.div(totalInvested).times(100);
  
  return {
    totalCurrencyUnits,
    totalInvested,
    liquidationValue,
    absoluteGainLoss,
    percentageReturn,
    traces: updatedTraces,
  };
}

export function convertCurrencyAmount(
  amount: DecimalType,
  rate: FXRate,
  direction: 'base-to-quote' | 'quote-to-base',
  side: 'bid' | 'ask'
): DecimalType {
  const rateValue = side === 'bid' ? rate.bid : rate.ask;
  
  if (direction === 'base-to-quote') {
    return amount.div(rateValue);
  } else {
    return amount.times(rateValue);
  }
}