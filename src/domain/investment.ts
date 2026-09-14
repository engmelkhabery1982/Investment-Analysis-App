import { DecimalType, Currency, AssetClass, Money, normalizeDate, isValidDate } from './common.js';
import { CashFlow, Installment, validateCashFlow } from './cashflow.js';
import { Decimal } from 'decimal.js';

export interface Investment {
  id: string;
  name: string;
  assetClass: AssetClass;
  currency: Currency;
  cashFlows: CashFlow[];
  installments?: Installment[];
  purchaseDate?: Date;
  valuationDate: Date;
  metadata?: Record<string, unknown>;
}

export interface RealEstateInvestment extends Investment {
  assetClass: 'real-estate';
  propertyAddress?: string;
  propertyType?: 'residential' | 'commercial' | 'land';
  totalArea?: number;
  unitArea?: number;
}

export interface GoldInvestment extends Investment {
  assetClass: 'gold';
  totalGrams?: DecimalType;
  averagePurchasePrice?: DecimalType;
}

export interface CurrencyInvestment extends Investment {
  assetClass: 'currency';
  targetCurrency: Currency;
  totalUnits?: DecimalType;
  averagePurchaseRate?: DecimalType;
}

export interface InflationIndexedInvestment extends Investment {
  assetClass: 'inflation-indexed';
  baseCPI?: DecimalType;
}

export function createInvestment(
  id: string,
  name: string,
  assetClass: AssetClass,
  currency: Currency,
  cashFlows: CashFlow[],
  valuationDate: Date,
  options?: {
    installments?: Installment[];
    purchaseDate?: Date;
    metadata?: Record<string, unknown>;
  }
): Investment {
  return {
    id,
    name,
    assetClass,
    currency,
    cashFlows: [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime()),
    installments: options?.installments,
    purchaseDate: options?.purchaseDate ? normalizeDate(options.purchaseDate) : undefined,
    valuationDate: normalizeDate(valuationDate),
    metadata: options?.metadata,
  };
}

export function getTotalInvested(investment: Investment): DecimalType {
  return investment.cashFlows.reduce(
    (sum, flow) => sum.plus(flow.amount),
    new Decimal(0)
  );
}

export function getCashFlowsBeforeDate(
  investment: Investment,
  date: Date
): CashFlow[] {
  const target = normalizeDate(date);
  return investment.cashFlows.filter(f => normalizeDate(f.date) <= target);
}

export function getCashFlowsAfterDate(
  investment: Investment,
  date: Date
): CashFlow[] {
  const target = normalizeDate(date);
  return investment.cashFlows.filter(f => normalizeDate(f.date) > target);
}

export function validateInvestment(investment: Investment): string[] {
  const errors: string[] = [];
  if (!investment.id || investment.id.trim() === '') {
    errors.push('Investment must have an ID');
  }
  if (!investment.name || investment.name.trim() === '') {
    errors.push('Investment must have a name');
  }
  if (!isValidDate(investment.valuationDate)) {
    errors.push('Investment must have a valid valuation date');
  }
  if (investment.cashFlows.length === 0) {
    errors.push('Investment must have at least one cash flow');
  }
  for (const flow of investment.cashFlows) {
    const flowErrors = validateCashFlow(flow);
    errors.push(...flowErrors.map(e => `Cash flow ${flow.id}: ${e}`));
  }
  return errors;
}