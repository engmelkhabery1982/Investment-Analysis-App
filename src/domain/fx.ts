import { DecimalType, Currency, DateResolutionPolicy, DateResolutionResult, normalizeDate, isValidDate } from './common.js';
import { Decimal } from 'decimal.js';

export type { Currency } from './common.js';

export interface FXRate {
  date: Date;
  baseCurrency: Currency;
  quoteCurrency: Currency;
  bid: DecimalType;
  ask: DecimalType;
  source?: string;
}

export interface FXRateRecord extends FXRate {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export function createFXRate(
  date: Date,
  baseCurrency: Currency,
  quoteCurrency: Currency,
  bid: DecimalType,
  ask: DecimalType,
  source?: string
): FXRate {
  return {
    date: normalizeDate(date),
    baseCurrency,
    quoteCurrency,
    bid,
    ask,
    source,
  };
}

export function validateFXRate(rate: FXRate): string[] {
  const errors: string[] = [];
  if (!isValidDate(rate.date)) {
    errors.push('FX rate must have a valid date');
  }
  if (rate.bid.isNaN() || rate.bid.lte(0)) {
    errors.push('Bid rate must be a positive number');
  }
  if (rate.ask.isNaN() || rate.ask.lte(0)) {
    errors.push('Ask rate must be a positive number');
  }
  if (rate.bid.gt(rate.ask)) {
    errors.push('Bid rate cannot exceed Ask rate');
  }
  if (rate.baseCurrency === rate.quoteCurrency) {
    errors.push('Base and quote currencies must be different');
  }
  return errors;
}

export function getSpread(rate: FXRate): DecimalType {
  return rate.ask.minus(rate.bid);
}

export function getSpreadPercentage(rate: FXRate): DecimalType {
  return rate.ask.minus(rate.bid).div(rate.bid).times(100);
}

export function invertRate(rate: FXRate): FXRate {
  return {
    ...rate,
    baseCurrency: rate.quoteCurrency,
    quoteCurrency: rate.baseCurrency,
    bid: new Decimal(1).div(rate.ask),
    ask: new Decimal(1).div(rate.bid),
  };
}

export function convertCurrency(
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

export function getPairKey(base: Currency, quote: Currency): string {
  return `${base}/${quote}`;
}