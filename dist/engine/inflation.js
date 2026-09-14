"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateInflationFactor = calculateInflationFactor;
exports.adjustForInflation = adjustForInflation;
exports.calculateInflationAdjustedInvestment = calculateInflationAdjustedInvestment;
exports.calculateRealReturn = calculateRealReturn;
exports.calculateCumulativeInflation = calculateCumulativeInflation;
exports.annualizeInflation = annualizeInflation;
const decimal_js_1 = require("decimal.js");
const results_js_1 = require("../domain/results.js");
const date_resolution_js_1 = require("../utils/date-resolution.js");
function calculateInflationFactor(cpiAtPayment, cpiAtValuation) {
    (0, date_resolution_js_1.validatePositiveRate)(cpiAtPayment, 'CPI at Payment');
    (0, date_resolution_js_1.validatePositiveRate)(cpiAtValuation, 'CPI at Valuation');
    return cpiAtValuation.div(cpiAtPayment);
}
function adjustForInflation(historicalAmount, cpiAtPayment, cpiAtValuation) {
    const factor = calculateInflationFactor(cpiAtPayment, cpiAtValuation);
    return historicalAmount.times(factor);
}
function calculateInflationAdjustedInvestment(cashFlows, cpiRecords, valuationDate, options) {
    const sortedFlows = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
    const sortedCPI = [...cpiRecords].sort((a, b) => a.date.getTime() - b.date.getTime());
    if (sortedCPI.length === 0) {
        throw new Error('No CPI records available');
    }
    const traces = [];
    let totalAdjustedValue = new decimal_js_1.Decimal(0);
    let totalInvested = new decimal_js_1.Decimal(0);
    const cpiDataPoints = sortedCPI.map(c => ({
        date: c.date,
        value: c,
    }));
    const valuationCPIResolution = (0, date_resolution_js_1.resolveMarketData)(valuationDate, cpiDataPoints, options.dateResolutionPolicy, p => p.value.date);
    const cpiAtValuation = valuationCPIResolution.value.index;
    for (const flow of sortedFlows) {
        (0, date_resolution_js_1.validateDateOrder)(flow.date, valuationDate);
        const paymentCPIResolution = (0, date_resolution_js_1.resolveMarketData)(flow.date, cpiDataPoints, options.dateResolutionPolicy, p => p.value.date);
        const cpiAtPayment = paymentCPIResolution.value.index;
        const inflationFactor = calculateInflationFactor(cpiAtPayment, cpiAtValuation);
        const adjustedValue = adjustForInflation(flow.amount, cpiAtPayment, cpiAtValuation);
        totalAdjustedValue = totalAdjustedValue.plus(adjustedValue);
        totalInvested = totalInvested.plus(flow.amount);
        const trace = (0, results_js_1.createInflationAdjustmentTrace)(flow.id, flow.date, flow.amount, cpiAtPayment, paymentCPIResolution.sourceDate, cpiAtValuation, valuationCPIResolution.sourceDate, inflationFactor, adjustedValue, options.dateResolutionPolicy);
        traces.push(trace);
    }
    const absoluteGainLoss = totalAdjustedValue.minus(totalInvested);
    const percentageReturn = totalInvested.isZero()
        ? new decimal_js_1.Decimal(0)
        : absoluteGainLoss.div(totalInvested).times(100);
    return {
        totalAdjustedValue,
        totalInvested,
        absoluteGainLoss,
        percentageReturn,
        traces,
    };
}
function calculateRealReturn(nominalReturn, inflationRate) {
    const one = new decimal_js_1.Decimal(1);
    const nominalFactor = one.plus(nominalReturn.div(100));
    const inflationFactor = one.plus(inflationRate.div(100));
    return nominalFactor.div(inflationFactor).minus(one).times(100);
}
function calculateCumulativeInflation(cpiStart, cpiEnd) {
    (0, date_resolution_js_1.validatePositiveRate)(cpiStart, 'Starting CPI');
    (0, date_resolution_js_1.validatePositiveRate)(cpiEnd, 'Ending CPI');
    return cpiEnd.div(cpiStart).minus(1).times(100);
}
function annualizeInflation(cumulativeInflation, years) {
    if (years.lte(0)) {
        throw new Error('Years must be positive');
    }
    const one = new decimal_js_1.Decimal(1);
    const base = one.plus(cumulativeInflation.div(100));
    return base.pow(one.div(years)).minus(one).times(100);
}
//# sourceMappingURL=inflation.js.map