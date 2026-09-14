import { DecimalType, DateResolutionPolicy, DateResolutionResult, normalizeDate, isValidDate } from './common.js';
import { Decimal } from 'decimal.js';

export interface GoldPrice {
  date: Date;
  bid: DecimalType;
  ask: DecimalType;
  currency: 'EGP';
  unit: 'gram' | 'ounce' | 'kilogram';
  source?: string;
}

export interface GoldPriceRecord extends GoldPrice {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export function createGoldPrice(
  date: Date,
  bid: DecimalType,
  ask: DecimalType,
  unit: 'gram' | 'ounce' | 'kilogram' = 'gram',
  source?: string
): GoldPrice {
  return {
    date: normalizeDate(date),
    bid,
    ask,
    currency: 'EGP',
    unit,
    source,
  };
}

export function validateGoldPrice(price: GoldPrice): string[] {
  const errors: string[] = [];
  if (!isValidDate(price.date)) {
    errors.push('Gold price must have a valid date');
  }
  if (price.bid.isNaN() || price.bid.lte(0)) {
    errors.push('Bid price must be a positive number');
  }
  if (price.ask.isNaN() || price.ask.lte(0)) {
    errors.push('Ask price must be a positive number');
  }
  if (price.bid.gt(price.ask)) {
    errors.push('Bid price cannot exceed Ask price');
  }
  if (price.currency !== 'EGP') {
    errors.push('Gold price currency must be EGP');
  }
  return errors;
}

export function getSpread(price: GoldPrice): DecimalType {
  return price.ask.minus(price.bid);
}

export function getSpreadPercentage(price: GoldPrice): DecimalType {
  return price.ask.minus(price.bid).div(price.bid).times(100);
}

export function convertGoldUnit(
  price: GoldPrice,
  targetUnit: 'gram' | 'ounce' | 'kilogram'
): GoldPrice {
  const conversionRates: Record<string, Decimal> = {
    'gram': new Decimal(1),
    'ounce': new Decimal(31.1035),
    'kilogram': new Decimal(1000),
  };
  
  const fromRate = conversionRates[price.unit];
  const toRate = conversionRates[targetUnit];
  
  if (!fromRate || !toRate) {
    throw new Error(`Unknown unit: ${price.unit} or ${targetUnit}`);
  }
  
  const factor = toRate.div(fromRate);
  
  return {
    ...price,
    bid: price.bid.times(factor),
    ask: price.ask.times(factor),
    unit: targetUnit,
  };
}