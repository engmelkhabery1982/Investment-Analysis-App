import { DecimalType, Money, Currency, normalizeDate, isValidDate } from './common.js';
import { Decimal } from 'decimal.js';

export interface CashFlow {
  id: string;
  date: Date;
  amount: DecimalType;
  currency: Currency;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface Installment extends CashFlow {
  installmentNumber: number;
  totalInstallments: number;
  dueDate: Date;
  paidDate?: Date;
  isPaid: boolean;
}

export interface CashFlowSeries {
  flows: CashFlow[];
  currency: Currency;
}

export function createCashFlow(
  id: string,
  date: Date,
  amount: DecimalType,
  currency: Currency,
  description?: string
): CashFlow {
  return {
    id,
    date: normalizeDate(date),
    amount,
    currency,
    description,
  };
}

export function createInstallment(
  id: string,
  date: Date,
  amount: DecimalType,
  currency: Currency,
  installmentNumber: number,
  totalInstallments: number,
  dueDate: Date,
  description?: string
): Installment {
  return {
    id,
    date: normalizeDate(date),
    amount,
    currency,
    installmentNumber,
    totalInstallments,
    dueDate: normalizeDate(dueDate),
    isPaid: true,
    description,
  };
}

export function sumCashFlows(flows: CashFlow[]): DecimalType {
  return flows.reduce((sum, flow) => sum.plus(flow.amount), new Decimal(0));
}

export function filterByDateRange(
  flows: CashFlow[],
  start: Date,
  end: Date
): CashFlow[] {
  const startNorm = normalizeDate(start);
  const endNorm = normalizeDate(end);
  return flows.filter(f => {
    const d = normalizeDate(f.date);
    return d >= startNorm && d <= endNorm;
  });
}

export function sortByDate(flows: CashFlow[]): CashFlow[] {
  return [...flows].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function groupByCurrency(flows: CashFlow[]): Map<Currency, CashFlow[]> {
  const groups = new Map<Currency, CashFlow[]>();
  for (const flow of flows) {
    const existing = groups.get(flow.currency) || [];
    existing.push(flow);
    groups.set(flow.currency, existing);
  }
  return groups;
}

export function toMoney(flow: CashFlow): Money {
  return {
    amount: flow.amount,
    currency: flow.currency,
  };
}

export function validateCashFlow(flow: CashFlow): string[] {
  const errors: string[] = [];
  if (!flow.id || flow.id.trim() === '') {
    errors.push('Cash flow must have an ID');
  }
  if (!isValidDate(flow.date)) {
    errors.push('Cash flow must have a valid date');
  }
  if (flow.amount.isNaN() || flow.amount.isNegative()) {
    errors.push('Cash flow amount must be a non-negative number');
  }
  if (!['EGP', 'USD', 'EUR', 'GBP'].includes(flow.currency)) {
    errors.push('Invalid currency');
  }
  return errors;
}