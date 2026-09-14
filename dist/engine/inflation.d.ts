import { DecimalType } from '../domain/common.js';
import { CPIRecord } from '../domain/cpi.js';
import { CashFlow } from '../domain/cashflow.js';
import { InflationAdjustmentTrace } from '../domain/results.js';
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
export declare function calculateInflationFactor(cpiAtPayment: DecimalType, cpiAtValuation: DecimalType): DecimalType;
export declare function adjustForInflation(historicalAmount: DecimalType, cpiAtPayment: DecimalType, cpiAtValuation: DecimalType): DecimalType;
export declare function calculateInflationAdjustedInvestment(cashFlows: CashFlow[], cpiRecords: CPIRecord[], valuationDate: Date, options: InflationCalculationOptions): InflationCalculationResult;
export declare function calculateRealReturn(nominalReturn: DecimalType, inflationRate: DecimalType): DecimalType;
export declare function calculateCumulativeInflation(cpiStart: DecimalType, cpiEnd: DecimalType): DecimalType;
export declare function annualizeInflation(cumulativeInflation: DecimalType, years: DecimalType): DecimalType;
//# sourceMappingURL=inflation.d.ts.map