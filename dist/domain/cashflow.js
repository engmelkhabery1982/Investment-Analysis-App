"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCashFlow = createCashFlow;
exports.createInstallment = createInstallment;
exports.sumCashFlows = sumCashFlows;
exports.filterByDateRange = filterByDateRange;
exports.sortByDate = sortByDate;
exports.groupByCurrency = groupByCurrency;
exports.toMoney = toMoney;
exports.validateCashFlow = validateCashFlow;
const common_js_1 = require("./common.js");
const decimal_js_1 = require("decimal.js");
function createCashFlow(id, date, amount, currency, description) {
    return {
        id,
        date: (0, common_js_1.normalizeDate)(date),
        amount,
        currency,
        description,
    };
}
function createInstallment(id, date, amount, currency, installmentNumber, totalInstallments, dueDate, description) {
    return {
        id,
        date: (0, common_js_1.normalizeDate)(date),
        amount,
        currency,
        installmentNumber,
        totalInstallments,
        dueDate: (0, common_js_1.normalizeDate)(dueDate),
        isPaid: true,
        description,
    };
}
function sumCashFlows(flows) {
    return flows.reduce((sum, flow) => sum.plus(flow.amount), new decimal_js_1.Decimal(0));
}
function filterByDateRange(flows, start, end) {
    const startNorm = (0, common_js_1.normalizeDate)(start);
    const endNorm = (0, common_js_1.normalizeDate)(end);
    return flows.filter(f => {
        const d = (0, common_js_1.normalizeDate)(f.date);
        return d >= startNorm && d <= endNorm;
    });
}
function sortByDate(flows) {
    return [...flows].sort((a, b) => a.date.getTime() - b.date.getTime());
}
function groupByCurrency(flows) {
    const groups = new Map();
    for (const flow of flows) {
        const existing = groups.get(flow.currency) || [];
        existing.push(flow);
        groups.set(flow.currency, existing);
    }
    return groups;
}
function toMoney(flow) {
    return {
        amount: flow.amount,
        currency: flow.currency,
    };
}
function validateCashFlow(flow) {
    const errors = [];
    if (!flow.id || flow.id.trim() === '') {
        errors.push('Cash flow must have an ID');
    }
    if (!(0, common_js_1.isValidDate)(flow.date)) {
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
//# sourceMappingURL=cashflow.js.map