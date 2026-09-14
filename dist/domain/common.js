"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidDate = isValidDate;
exports.normalizeDate = normalizeDate;
exports.daysBetween = daysBetween;
exports.yearsBetween = yearsBetween;
const decimal_js_1 = require("decimal.js");
function isValidDate(date) {
    return date instanceof Date && !isNaN(date.getTime());
}
function normalizeDate(date) {
    const normalized = new Date(date);
    normalized.setUTCHours(0, 0, 0, 0);
    return normalized;
}
function daysBetween(start, end) {
    const startNorm = normalizeDate(start);
    const endNorm = normalizeDate(end);
    const diffTime = endNorm.getTime() - startNorm.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
}
function yearsBetween(start, end) {
    const days = daysBetween(start, end);
    return new decimal_js_1.Decimal(days).div(365);
}
//# sourceMappingURL=common.js.map