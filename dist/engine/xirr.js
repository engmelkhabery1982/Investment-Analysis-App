"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareXIRRInputs = prepareXIRRInputs;
exports.calculateXNPV = calculateXNPV;
exports.calculateXIRR = calculateXIRR;
exports.calculateXNPVResult = calculateXNPVResult;
exports.calculateXIRRFromCashFlows = calculateXIRRFromCashFlows;
exports.calculateXNPVFromCashFlows = calculateXNPVFromCashFlows;
exports.validateXIRRInputs = validateXIRRInputs;
const decimal_js_1 = require("decimal.js");
const common_js_1 = require("../domain/common.js");
function prepareXIRRInputs(cashFlows) {
    return cashFlows
        .filter(f => !f.amount.isZero())
        .map(f => ({
        date: (0, common_js_1.normalizeDate)(f.date),
        amount: f.amount,
    }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());
}
function calculateXNPV(inputs, discountRate) {
    if (inputs.length === 0) {
        return new decimal_js_1.Decimal(0);
    }
    const firstDate = inputs[0].date;
    let npv = new decimal_js_1.Decimal(0);
    for (const input of inputs) {
        const daysDiff = daysBetween(firstDate, input.date);
        const years = new decimal_js_1.Decimal(daysDiff).div(365);
        const discountFactor = new decimal_js_1.Decimal(1).plus(discountRate).pow(years);
        npv = npv.plus(input.amount.div(discountFactor));
    }
    return npv;
}
function calculateXIRR(inputs, options = {}) {
    const guess = options.guess || new decimal_js_1.Decimal(0.1);
    const maxIterations = options.maxIterations || 100;
    const tolerance = options.tolerance || new decimal_js_1.Decimal('1e-10');
    if (inputs.length < 2) {
        return {
            rate: new decimal_js_1.Decimal(0),
            iterations: 0,
            converged: false,
            error: 'At least two cash flows required for XIRR',
        };
    }
    const hasPositive = inputs.some(i => i.amount.gt(0));
    const hasNegative = inputs.some(i => i.amount.lt(0));
    if (!hasPositive || !hasNegative) {
        return {
            rate: new decimal_js_1.Decimal(0),
            iterations: 0,
            converged: false,
            error: 'Cash flows must have both positive and negative values',
        };
    }
    let rate = guess;
    let iterations = 0;
    let converged = false;
    for (let i = 0; i < maxIterations; i++) {
        iterations++;
        let npv = new decimal_js_1.Decimal(0);
        let dNpv = new decimal_js_1.Decimal(0);
        const firstDate = inputs[0].date;
        for (const input of inputs) {
            const daysDiff = daysBetween(firstDate, input.date);
            const years = new decimal_js_1.Decimal(daysDiff).div(365);
            const factor = new decimal_js_1.Decimal(1).plus(rate).pow(years);
            const pv = input.amount.div(factor);
            npv = npv.plus(pv);
            if (!years.isZero()) {
                const derivative = input.amount.times(years).div(factor.times(new decimal_js_1.Decimal(1).plus(rate)));
                dNpv = dNpv.minus(derivative);
            }
        }
        if (npv.abs().lt(tolerance)) {
            converged = true;
            break;
        }
        if (dNpv.isZero()) {
            return {
                rate,
                iterations,
                converged: false,
                error: 'Derivative is zero, cannot converge',
            };
        }
        const newRate = rate.minus(npv.div(dNpv));
        if (newRate.lte(-1)) {
            return {
                rate,
                iterations,
                converged: false,
                error: 'Rate converged to <= -100%',
            };
        }
        const rateChange = newRate.minus(rate).abs();
        rate = newRate;
        if (rateChange.lt(tolerance)) {
            converged = true;
            break;
        }
    }
    return {
        rate,
        iterations,
        converged,
        error: converged ? undefined : 'Failed to converge within max iterations',
    };
}
function calculateXNPVResult(inputs, discountRate) {
    const value = calculateXNPV(inputs, discountRate);
    return { value, rate: discountRate };
}
function calculateXIRRFromCashFlows(cashFlows, options = {}) {
    const inputs = prepareXIRRInputs(cashFlows);
    return calculateXIRR(inputs, options);
}
function calculateXNPVFromCashFlows(cashFlows, discountRate) {
    const inputs = prepareXIRRInputs(cashFlows);
    return calculateXNPVResult(inputs, discountRate);
}
function daysBetween(start, end) {
    const startNorm = (0, common_js_1.normalizeDate)(start);
    const endNorm = (0, common_js_1.normalizeDate)(end);
    const diffTime = endNorm.getTime() - startNorm.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
}
function validateXIRRInputs(inputs) {
    const errors = [];
    if (inputs.length < 2) {
        errors.push('At least two cash flows required');
    }
    const hasPositive = inputs.some(i => i.amount.gt(0));
    const hasNegative = inputs.some(i => i.amount.lt(0));
    if (!hasPositive) {
        errors.push('At least one positive cash flow required');
    }
    if (!hasNegative) {
        errors.push('At least one negative cash flow required');
    }
    for (let i = 1; i < inputs.length; i++) {
        if (inputs[i].date <= inputs[i - 1].date) {
            errors.push(`Cash flow dates must be strictly increasing (index ${i})`);
        }
    }
    return errors;
}
//# sourceMappingURL=xirr.js.map