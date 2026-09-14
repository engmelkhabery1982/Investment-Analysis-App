"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInvestment = createInvestment;
exports.getTotalInvested = getTotalInvested;
exports.getCashFlowsBeforeDate = getCashFlowsBeforeDate;
exports.getCashFlowsAfterDate = getCashFlowsAfterDate;
exports.validateInvestment = validateInvestment;
const common_js_1 = require("./common.js");
const cashflow_js_1 = require("./cashflow.js");
const decimal_js_1 = require("decimal.js");
function createInvestment(id, name, assetClass, currency, cashFlows, valuationDate, options) {
    return {
        id,
        name,
        assetClass,
        currency,
        cashFlows: [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime()),
        installments: options?.installments,
        purchaseDate: options?.purchaseDate ? (0, common_js_1.normalizeDate)(options.purchaseDate) : undefined,
        valuationDate: (0, common_js_1.normalizeDate)(valuationDate),
        metadata: options?.metadata,
    };
}
function getTotalInvested(investment) {
    return investment.cashFlows.reduce((sum, flow) => sum.plus(flow.amount), new decimal_js_1.Decimal(0));
}
function getCashFlowsBeforeDate(investment, date) {
    const target = (0, common_js_1.normalizeDate)(date);
    return investment.cashFlows.filter(f => (0, common_js_1.normalizeDate)(f.date) <= target);
}
function getCashFlowsAfterDate(investment, date) {
    const target = (0, common_js_1.normalizeDate)(date);
    return investment.cashFlows.filter(f => (0, common_js_1.normalizeDate)(f.date) > target);
}
function validateInvestment(investment) {
    const errors = [];
    if (!investment.id || investment.id.trim() === '') {
        errors.push('Investment must have an ID');
    }
    if (!investment.name || investment.name.trim() === '') {
        errors.push('Investment must have a name');
    }
    if (!(0, common_js_1.isValidDate)(investment.valuationDate)) {
        errors.push('Investment must have a valid valuation date');
    }
    if (investment.cashFlows.length === 0) {
        errors.push('Investment must have at least one cash flow');
    }
    for (const flow of investment.cashFlows) {
        const flowErrors = (0, cashflow_js_1.validateCashFlow)(flow);
        errors.push(...flowErrors.map(e => `Cash flow ${flow.id}: ${e}`));
    }
    return errors;
}
//# sourceMappingURL=investment.js.map