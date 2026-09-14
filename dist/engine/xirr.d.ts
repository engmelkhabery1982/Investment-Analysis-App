import { Decimal } from 'decimal.js';
import { CashFlow } from '../domain/cashflow.js';
import { XIRRInput, XIRRResult, XNPVResult } from '../domain/results.js';
export interface XIRROptions {
    guess?: Decimal;
    maxIterations?: number;
    tolerance?: Decimal;
}
export interface XNPVOptions {
    discountRate: Decimal;
}
export declare function prepareXIRRInputs(cashFlows: CashFlow[]): XIRRInput[];
export declare function calculateXNPV(inputs: XIRRInput[], discountRate: Decimal): Decimal;
export declare function calculateXIRR(inputs: XIRRInput[], options?: XIRROptions): XIRRResult;
export declare function calculateXNPVResult(inputs: XIRRInput[], discountRate: Decimal): XNPVResult;
export declare function calculateXIRRFromCashFlows(cashFlows: CashFlow[], options?: XIRROptions): XIRRResult;
export declare function calculateXNPVFromCashFlows(cashFlows: CashFlow[], discountRate: Decimal): XNPVResult;
export declare function validateXIRRInputs(inputs: XIRRInput[]): string[];
//# sourceMappingURL=xirr.d.ts.map