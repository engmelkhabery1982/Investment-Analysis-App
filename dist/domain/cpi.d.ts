import { DecimalType } from './common.js';
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
export declare function createCPIRecord(date: Date, index: DecimalType, baseYear?: number, country?: string, source?: string): CPIRecord;
export declare function validateCPIRecord(record: CPIRecord): string[];
export declare function calculateInflationFactor(cpiAtPayment: DecimalType, cpiAtValuation: DecimalType): DecimalType;
export declare function adjustForInflation(historicalAmount: DecimalType, cpiAtPayment: DecimalType, cpiAtValuation: DecimalType): DecimalType;
export declare function calculateCumulativeInflation(cpiStart: DecimalType, cpiEnd: DecimalType): DecimalType;
export declare function annualizeInflation(cumulativeInflation: DecimalType, years: DecimalType): DecimalType;
//# sourceMappingURL=cpi.d.ts.map