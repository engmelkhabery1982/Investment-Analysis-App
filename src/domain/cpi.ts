import { DecimalType, normalizeDate, isValidDate } from './common.js';
import { Decimal } from 'decimal.js';

export interface CPIRecord {
  date: Date;
  index: DecimalType;
  baseYear: number;
  country: string;
  source?: string;
}

export interface CPIRecordStored extends CPIRecord {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export function createCPIRecord(
  date: Date,
  index: DecimalType,
  baseYear: number = 2010,
  country: string = 'Egypt',
  source?: string
): CPIRecord {
  return {
    date: normalizeDate(date),
    index,
    baseYear,
    country,
    source,
  };
}

export function validateCPIRecord(record: CPIRecord): string[] {
  const errors: string[] = [];
  if (!isValidDate(record.date)) {
    errors.push('CPI record must have a valid date');
  }
  if (record.index.isNaN() || record.index.lte(0)) {
    errors.push('CPI index must be a positive number');
  }
  if (record.baseYear < 1900 || record.baseYear > 2100) {
    errors.push('Base year must be between 1900 and 2100');
  }
  return errors;
}

export function calculateInflationFactor(
  cpiAtPayment: DecimalType,
  cpiAtValuation: DecimalType
): DecimalType {
  if (cpiAtPayment.isZero()) {
    throw new Error('CPI at payment date cannot be zero');
  }
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

export function calculateCumulativeInflation(
  cpiStart: DecimalType,
  cpiEnd: DecimalType
): DecimalType {
  if (cpiStart.isZero()) {
    throw new Error('Starting CPI cannot be zero');
  }
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