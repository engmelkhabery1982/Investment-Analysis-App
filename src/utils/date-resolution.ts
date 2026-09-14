import { Decimal } from 'decimal.js';
import { DateResolutionPolicy, DateResolutionResult, normalizeDate, isValidDate } from '../domain/common.js';

export interface MarketDataPoint<T> {
  date: Date;
  value: T;
}

export function resolveDate<T>(
  requestedDate: Date,
  availableDates: Date[],
  policy: DateResolutionPolicy
): Date {
  const requested = normalizeDate(requestedDate);
  const available = availableDates.map(d => normalizeDate(d)).sort((a, b) => a.getTime() - b.getTime());
  
  if (available.length === 0) {
    throw new Error('No available dates for resolution');
  }
  
  const exactMatch = available.find(d => d.getTime() === requested.getTime());
  if (exactMatch) {
    return exactMatch;
  }
  
  switch (policy) {
    case 'exact':
      throw new Error(`No exact market data date found for ${requested.toISOString().split('T')[0]}`);
    
    case 'previous': {
      const previous = available.filter(d => d.getTime() <= requested.getTime());
      if (previous.length === 0) {
        throw new Error(`No previous market data date available before ${requested.toISOString().split('T')[0]}`);
      }
      return previous[previous.length - 1]!;
    }
    
    case 'nearest': {
      if (available.length === 0) {
        throw new Error('No available dates for nearest resolution');
      }
      
      // Find the closest date with deterministic tie-break: previous wins
      let nearest = available[0]!;
      let minDiff = Math.abs(available[0]!.getTime() - requested.getTime());
      
      for (const date of available) {
        const diff = Math.abs(date.getTime() - requested.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          nearest = date;
        } else if (diff === minDiff && date.getTime() < nearest.getTime()) {
          // Tie-break: choose the earlier (previous) date
          nearest = date;
        }
      }
      return nearest;
    }
    
    default:
      throw new Error(`Unknown date resolution policy: ${policy}`);
  }
}

export function resolveMarketData<T>(
  requestedDate: Date,
  dataPoints: MarketDataPoint<T>[],
  policy: DateResolutionPolicy,
  dateExtractor: (point: MarketDataPoint<T>) => Date
): DateResolutionResult<T> {
  const availableDates = dataPoints.map(dateExtractor);
  const resolvedDate = resolveDate(requestedDate, availableDates, policy);
  const resolvedPoint = dataPoints.find(p => dateExtractor(p).getTime() === resolvedDate.getTime());
  
  if (!resolvedPoint) {
    throw new Error('Resolved date not found in data points');
  }
  
  return {
    value: resolvedPoint.value,
    sourceDate: resolvedDate,
    requestedDate: normalizeDate(requestedDate),
    policy,
  };
}

export function createDateResolver<T>(
  dataPoints: MarketDataPoint<T>[],
  dateExtractor: (point: MarketDataPoint<T>) => Date,
  defaultPolicy: DateResolutionPolicy = 'previous'
) {
  return {
    resolve: (requestedDate: Date, policy?: DateResolutionPolicy) => 
      resolveMarketData(requestedDate, dataPoints, policy || defaultPolicy, dateExtractor),
    
    resolveOrThrow: (requestedDate: Date, policy?: DateResolutionPolicy) => {
      const result = resolveMarketData(requestedDate, dataPoints, policy || defaultPolicy, dateExtractor);
      return result.value;
    },
    
    getAvailableDates: () => dataPoints.map(dateExtractor).map(normalizeDate).sort((a, b) => a.getTime() - b.getTime()),
    
    hasExactDate: (date: Date) => 
      dataPoints.some(p => dateExtractor(p).getTime() === normalizeDate(date).getTime()),
  };
}

export function validateDateOrder(paymentDate: Date, valuationDate: Date): void {
  const payment = normalizeDate(paymentDate);
  const valuation = normalizeDate(valuationDate);
  
  if (payment > valuation) {
    throw new Error(
      `Payment date (${payment.toISOString().split('T')[0]}) cannot be after valuation date (${valuation.toISOString().split('T')[0]})`
    );
  }
}

export function validatePositiveRate(rate: Decimal, name: string): void {
  if (rate.isNaN() || rate.lte(0)) {
    throw new Error(`${name} must be a positive number, got ${rate.toString()}`);
  }
}

export function validateNonZeroAmount(amount: Decimal, name: string): void {
  if (amount.isZero()) {
    throw new Error(`${name} cannot be zero`);
  }
}