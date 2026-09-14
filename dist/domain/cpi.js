"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCPIRecord = createCPIRecord;
exports.validateCPIRecord = validateCPIRecord;
exports.calculateInflationFactor = calculateInflationFactor;
exports.adjustForInflation = adjustForInflation;
exports.calculateCumulativeInflation = calculateCumulativeInflation;
exports.annualizeInflation = annualizeInflation;
const common_js_1 = require("./common.js");
const decimal_js_1 = require("decimal.js");
function createCPIRecord(date, index, baseYear = 2010, country = 'Egypt', source) {
    return {
        date: (0, common_js_1.normalizeDate)(date),
        index,
        baseYear,
        country,
        source,
    };
}
function validateCPIRecord(record) {
    const errors = [];
    if (!(0, common_js_1.isValidDate)(record.date)) {
        errors.push('CPI record must have a valid date');
    }
    if (record.index.isNaN() || record.index.lte(0)) {
        errors.push('CPI index must be a positive number');
    }
    if (record.baseYear < 1900 || record.baseYear > 2100) {
        errors.push('Base year must be between 1900 and 2100');
    }
    return errors;
}
function calculateInflationFactor(cpiAtPayment, cpiAtValuation) {
    if (cpiAtPayment.isZero()) {
        throw new Error('CPI at payment date cannot be zero');
    }
    return cpiAtValuation.div(cpiAtPayment);
}
function adjustForInflation(historicalAmount, cpiAtPayment, cpiAtValuation) {
    const factor = calculateInflationFactor(cpiAtPayment, cpiAtValuation);
    return historicalAmount.times(factor);
}
function calculateCumulativeInflation(cpiStart, cpiEnd) {
    if (cpiStart.isZero()) {
        throw new Error('Starting CPI cannot be zero');
    }
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
//# sourceMappingURL=cpi.js.map