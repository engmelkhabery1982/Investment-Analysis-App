import { Decimal } from 'decimal.js';
import { DecimalType } from '../domain/common.js';
import { GoldPrice } from '../domain/gold.js';
import { CashFlow } from '../domain/cashflow.js';
import { 
  GoldPurchaseTrace, 
  createGoldPurchaseTrace 
} from '../domain/results.js';
import { 
  resolveMarketData, 
  validateDateOrder, 
  validatePositiveRate,
  validateNonZeroAmount,
  MarketDataPoint 
} from '../utils/date-resolution.js';
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

export function calculateGoldQuantity(
  paymentAmount: DecimalType,
  goldAskPrice: DecimalType
): DecimalType {
  validatePositiveRate(goldAskPrice, 'Gold Ask Price');
  validateNonZeroAmount(paymentAmount, 'Payment Amount');
  return paymentAmount.div(goldAskPrice);
}

export function calculateGoldLiquidationValue(
  totalGoldQuantity: DecimalType,
  goldBidPrice: DecimalType
): DecimalType {
  validatePositiveRate(goldBidPrice, 'Gold Bid Price');
  validateNonZeroAmount(totalGoldQuantity, 'Total Gold Quantity');
  return totalGoldQuantity.times(goldBidPrice);
}

export function calculateGoldInvestment(
  cashFlows: CashFlow[],
  goldPrices: GoldPrice[],
  valuationDate: Date,
  options: GoldCalculationOptions
): GoldCalculationResult {
  const sortedFlows = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const sortedPrices = [...goldPrices].sort((a, b) => a.date.getTime() - b.date.getTime());
  
  const traces: GoldPurchaseTrace[] = [];
  let totalGoldQuantity = new Decimal(0);
  let totalInvested = new Decimal(0);
  
  for (const flow of sortedFlows) {
    validateDateOrder(flow.date, valuationDate);
    
    const priceDataPoints: MarketDataPoint<GoldPrice>[] = sortedPrices.map(p => ({
      date: p.date,
      value: p,
    }));
    
    const askResolution = resolveMarketData(
      flow.date,
      priceDataPoints,
      options.dateResolutionPolicy,
      p => p.value.date
    );
    
    const goldAskPrice = askResolution.value.ask;
    const goldQuantity = calculateGoldQuantity(flow.amount, goldAskPrice);
    
    totalGoldQuantity = totalGoldQuantity.plus(goldQuantity);
    totalInvested = totalInvested.plus(flow.amount);
    
    const bidResolution = resolveMarketData(
      valuationDate,
      priceDataPoints,
      options.dateResolutionPolicy,
      p => p.value.date
    );
    
    const trace = createGoldPurchaseTrace(
      flow.id,
      flow.date,
      flow.amount,
      goldAskPrice,
      askResolution.sourceDate,
      goldQuantity,
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
    sortedPrices.map(p => ({ date: p.date, value: p })),
    options.dateResolutionPolicy,
    p => p.value.date
  );
  
  const goldBidPrice = bidResolution.value.bid;
  const liquidationValue = calculateGoldLiquidationValue(totalGoldQuantity, goldBidPrice);
  
  const updatedTraces = traces.map(t => ({
    ...t,
    liquidationValue: t.goldQuantity.times(goldBidPrice),
  }));
  
  const absoluteGainLoss = liquidationValue.minus(totalInvested);
  const percentageReturn = totalInvested.isZero() 
    ? new Decimal(0) 
    : absoluteGainLoss.div(totalInvested).times(100);
  
  return {
    totalGoldQuantity,
    totalInvested,
    liquidationValue,
    absoluteGainLoss,
    percentageReturn,
    traces: updatedTraces,
  };
}

export function calculateGoldInvestmentSimple(
  payments: Array<{ date: Date; amount: DecimalType }>,
  goldAskPrices: Map<string, DecimalType>,
  goldBidPrice: DecimalType,
  valuationDate: Date
): { totalGold: DecimalType; totalInvested: DecimalType; liquidationValue: DecimalType } {
  let totalGold = new Decimal(0);
  let totalInvested = new Decimal(0);
  
  for (const payment of payments) {
    const dateKey = payment.date.toISOString().split('T')[0]!;
    const askPrice = goldAskPrices.get(dateKey);
    
    if (!askPrice) {
      throw new Error(`No gold ask price for date ${dateKey}`);
    }
    
    const goldQty = calculateGoldQuantity(payment.amount, askPrice!);
    totalGold = totalGold.plus(goldQty);
    totalInvested = totalInvested.plus(payment.amount);
  }
  
  const liquidationValue = calculateGoldLiquidationValue(totalGold, goldBidPrice);
  
  return { totalGold, totalInvested, liquidationValue };
}