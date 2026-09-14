import { Decimal } from 'decimal.js';

export type DateResolutionPolicy = 
  | 'exact' 
  | 'previous' 
  | 'nearest';

export interface DateResolutionResult<T> {
  value: T;
  sourceDate: Date;
  requestedDate: Date;
  policy: DateResolutionPolicy;
}

export type Currency = 'EGP' | 'USD' | 'EUR' | 'GBP';

export type AssetClass = 
  | 'real-estate' 
  | 'gold' 
  | 'currency' 
  | 'inflation-indexed' 
  | 'custom';

export type DecimalType = Decimal;

export interface Money {
  amount: DecimalType;
  currency: Currency;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export function isValidDate(date: unknown): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}

export function normalizeDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

export function daysBetween(start: Date, end: Date): number {
  const startNorm = normalizeDate(start);
  const endNorm = normalizeDate(end);
  const diffTime = endNorm.getTime() - startNorm.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export function yearsBetween(start: Date, end: Date): DecimalType {
  const days = daysBetween(start, end);
  return new Decimal(days).div(365);
}