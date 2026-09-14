import { DecimalType, Currency, AssetClass } from './common.js';
import { CashFlow, Installment } from './cashflow.js';
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
export declare function createInvestment(id: string, name: string, assetClass: AssetClass, currency: Currency, cashFlows: CashFlow[], valuationDate: Date, options?: {
    installments?: Installment[];
    purchaseDate?: Date;
    metadata?: Record<string, unknown>;
}): Investment;
export declare function getTotalInvested(investment: Investment): DecimalType;
export declare function getCashFlowsBeforeDate(investment: Investment, date: Date): CashFlow[];
export declare function getCashFlowsAfterDate(investment: Investment, date: Date): CashFlow[];
export declare function validateInvestment(investment: Investment): string[];
//# sourceMappingURL=investment.d.ts.map