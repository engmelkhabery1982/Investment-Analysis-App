import { Decimal } from 'decimal.js';
import { DecimalType } from '../domain/common.js';
import { CPIRecord } from '../domain/cpi.js';
import { CashFlow } from '../domain/cashflow.js';
import { 
  InflationAdjustmentTrace, 
  createInflationAdjustmentTrace 
} from '../domain/results.js';
import { 
  resolveMarketData, 
  validateDateOrder, 
  validatePositiveRate,
  validateNonZeroAmount,
  MarketDataPoint 
} from '../utils/date-resolution.js';
import { DateResolutionPolicy } from '../domain/common.js';

export interface InflationCalculationOptions {
  dateResolutionPolicy: DateResolutionPolicy;
}

export interface InflationCalculationResult {
  totalAdjustedValue: DecimalType;
  totalInvested: DecimalType;
  absoluteGainLoss: DecimalType;
  percentageReturn: DecimalType;
  traces: InflationAdjustmentTrace[];
}

export function calculateInflationFactor(
  cpiAtPayment: DecimalType,
  cpiAtValuation: DecimalType
): DecimalType {
  validatePositiveRate(cpiAtPayment, 'CPI at Payment');
  validatePositiveRate(cpiAtValuation, 'CPI at Valuation');
  return cpiAtValuation.div(cpiAtPayment);
}

export function adjustForInflation(
  historicalAmount: DecimalType,
  cpiAtPayment: DecimalType,
  cpiAtValuation: DecimalType
): DecimalType {
  const factor = calculateInflationFactor(cpiAtPayment, cpiAtValuation);
  return historicalAmount.times(factor);
}

export function calculateInflationAdjustedInvestment(
  cashFlows: CashFlow[],
  cpiRecords: CPIRecord[],
  valuationDate: Date,
  options: InflationCalculationOptions
): InflationCalculationResult {
  const sortedFlows = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const sortedCPI = [...cpiRecords].sort((a, b) => a.date.getTime() - b.date.getTime());
  
  if (sortedCPI.length === 0) {
    throw new Error('No CPI records available');
  }
  
  const traces: InflationAdjustmentTrace[] = [];
  let totalAdjustedValue = new Decimal(0);
  let totalInvested = new Decimal(0);
  
  const cpiDataPoints: MarketDataPoint<CPIRecord>[] = sortedCPI.map(c => ({
    date: c.date,
    value: c,
  }));
  
  const valuationCPIResolution = resolveMarketData(
    valuationDate,
    cpiDataPoints,
    options.dateResolutionPolicy,
    p => p.value.date
  );
  
  const cpiAtValuation = valuationCPIResolution.value.index;
  
  for (const flow of sortedFlows) {
    validateDateOrder(flow.date, valuationDate);
    
    const paymentCPIResolution = resolveMarketData(
      flow.date,
      cpiDataPoints,
      options.dateResolutionPolicy,
      p => p.value.date
    );
    
    const cpiAtPayment = paymentCPIResolution.value.index;
    const inflationFactor = calculateInflationFactor(cpiAtPayment, cpiAtValuation);
    const adjustedValue = adjustForInflation(flow.amount, cpiAtPayment, cpiAtValuation);
    
    totalAdjustedValue = totalAdjustedValue.plus(adjustedValue);
    totalInvested = totalInvested.plus(flow.amount);
    
    const trace = createInflationAdjustmentTrace(
      flow.id,
      flow.date,
      flow.amount,
      cpiAtPayment,
      paymentCPIResolution.sourceDate,
      cpiAtValuation,
      valuationCPIResolution.sourceDate,
      inflationFactor,
      adjustedValue,
      options.dateResolutionPolicy
    );
    
    traces.push(trace);
  }
  
  const absoluteGainLoss = totalAdjustedValue.minus(totalInvested);
  const percentageReturn = totalInvested.isZero() 
    ? new Decimal(0) 
    : absoluteGainLoss.div(totalInvested).times(100);
  
  return {
    totalAdjustedValue,
    totalInvested,
    absoluteGainLoss,
    percentageReturn,
    traces,
  };
}

export function calculateRealReturn(
  nominalReturn: DecimalType,
  inflationRate: DecimalType
): DecimalType {
  const one = new Decimal(1);
  const nominalFactor = one.plus(nominalReturn.div(100));
  const inflationFactor = one.plus(inflationRate.div(100));
  return nominalFactor.div(inflationFactor).minus(one).times(100);
}

export function calculateCumulativeInflation(
  cpiStart: DecimalType,
  cpiEnd: DecimalType
): DecimalType {
  validatePositiveRate(cpiStart, 'Starting CPI');
  validatePositiveRate(cpiEnd, 'Ending CPI');
  return cpiEnd.div(cpiStart).minus(1).times(100);
}

export function annualizeInflation(
  cumulativeInflation: DecimalType,
  years: DecimalType
): DecimalType {
  if (years.lte(0)) {
    throw new Error('Years must be positive');
  }
  const one = new Decimal(1);
  const base = one.plus(cumulativeInflation.div(100));
  return base.pow(one.div(years)).minus(one).times(100);
}