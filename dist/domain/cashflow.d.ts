import { DecimalType, Money, Currency } from './common.js';
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
export declare function createCashFlow(id: string, date: Date, amount: DecimalType, currency: Currency, description?: string): CashFlow;
export declare function createInstallment(id: string, date: Date, amount: DecimalType, currency: Currency, installmentNumber: number, totalInstallments: number, dueDate: Date, description?: string): Installment;
export declare function sumCashFlows(flows: CashFlow[]): DecimalType;
export declare function filterByDateRange(flows: CashFlow[], start: Date, end: Date): CashFlow[];
export declare function sortByDate(flows: CashFlow[]): CashFlow[];
export declare function groupByCurrency(flows: CashFlow[]): Map<Currency, CashFlow[]>;
export declare function toMoney(flow: CashFlow): Money;
export declare function validateCashFlow(flow: CashFlow): string[];
//# sourceMappingURL=cashflow.d.ts.map