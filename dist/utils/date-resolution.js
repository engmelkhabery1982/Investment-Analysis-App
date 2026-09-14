"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDate = resolveDate;
exports.resolveMarketData = resolveMarketData;
exports.createDateResolver = createDateResolver;
exports.validateDateOrder = validateDateOrder;
exports.validatePositiveRate = validatePositiveRate;
exports.validateNonZeroAmount = validateNonZeroAmount;
const common_js_1 = require("../domain/common.js");
function resolveDate(requestedDate, availableDates, policy) {
    const requested = (0, common_js_1.normalizeDate)(requestedDate);
    const available = availableDates.map(d => (0, common_js_1.normalizeDate)(d)).sort((a, b) => a.getTime() - b.getTime());
    if (available.length === 0) {
        throw new Error('No available dates for resolution');
    }
    const exactMatch = available.find(d => d.getTime() === requested.getTime());
    if (exactMatch) {
        return exactMatch;
    }
    switch (policy) {
        case 'exact':
            throw new Error(`No exact market data date found for ${requested.toISOString().split('T')[0]}`);
        case 'previous': {
            const previous = available.filter(d => d.getTime() <= requested.getTime());
            if (previous.length === 0) {
                throw new Error(`No previous market data date available before ${requested.toISOString().split('T')[0]}`);
            }
            return previous[previous.length - 1];
        }
        case 'nearest': {
            if (available.length === 0) {
                throw new Error('No available dates for nearest resolution');
            }
            let nearest = available[0];
            let minDiff = Math.abs(available[0].getTime() - requested.getTime());
            for (const date of available) {
                const diff = Math.abs(date.getTime() - requested.getTime());
                if (diff < minDiff) {
                    minDiff = diff;
                    nearest = date;
                }
            }
            return nearest;
        }
        default:
            throw new Error(`Unknown date resolution policy: ${policy}`);
    }
}
function resolveMarketData(requestedDate, dataPoints, policy, dateExtractor) {
    const availableDates = dataPoints.map(dateExtractor);
    const resolvedDate = resolveDate(requestedDate, availableDates, policy);
    const resolvedPoint = dataPoints.find(p => dateExtractor(p).getTime() === resolvedDate.getTime());
    if (!resolvedPoint) {
        throw new Error('Resolved date not found in data points');
    }
    return {
        value: resolvedPoint.value,
        sourceDate: resolvedDate,
        requestedDate: (0, common_js_1.normalizeDate)(requestedDate),
        policy,
    };
}
function createDateResolver(dataPoints, dateExtractor, defaultPolicy = 'previous') {
    return {
        resolve: (requestedDate, policy) => resolveMarketData(requestedDate, dataPoints, policy || defaultPolicy, dateExtractor),
        resolveOrThrow: (requestedDate, policy) => {
            const result = resolveMarketData(requestedDate, dataPoints, policy || defaultPolicy, dateExtractor);
            return result.value;
        },
        getAvailableDates: () => dataPoints.map(dateExtractor).map(common_js_1.normalizeDate).sort((a, b) => a.getTime() - b.getTime()),
        hasExactDate: (date) => dataPoints.some(p => dateExtractor(p).getTime() === (0, common_js_1.normalizeDate)(date).getTime()),
    };
}
function validateDateOrder(paymentDate, valuationDate) {
    const payment = (0, common_js_1.normalizeDate)(paymentDate);
    const valuation = (0, common_js_1.normalizeDate)(valuationDate);
    if (payment >= valuation) {
        throw new Error(`Payment date (${payment.toISOString().split('T')[0]}) cannot be on or after valuation date (${valuation.toISOString().split('T')[0]})`);
    }
}
function validatePositiveRate(rate, name) {
    if (rate.isNaN() || rate.lte(0)) {
        throw new Error(`${name} must be a positive number, got ${rate.toString()}`);
    }
}
function validateNonZeroAmount(amount, name) {
    if (amount.isZero()) {
        throw new Error(`${name} cannot be zero`);
    }
}
//# sourceMappingURL=date-resolution.js.map