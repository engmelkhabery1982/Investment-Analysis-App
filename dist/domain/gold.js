"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGoldPrice = createGoldPrice;
exports.validateGoldPrice = validateGoldPrice;
exports.getSpread = getSpread;
exports.getSpreadPercentage = getSpreadPercentage;
exports.convertGoldUnit = convertGoldUnit;
const common_js_1 = require("./common.js");
const decimal_js_1 = require("decimal.js");
function createGoldPrice(date, bid, ask, unit = 'gram', source) {
    return {
        date: (0, common_js_1.normalizeDate)(date),
        bid,
        ask,
        currency: 'EGP',
        unit,
        source,
    };
}
function validateGoldPrice(price) {
    const errors = [];
    if (!(0, common_js_1.isValidDate)(price.date)) {
        errors.push('Gold price must have a valid date');
    }
    if (price.bid.isNaN() || price.bid.lte(0)) {
        errors.push('Bid price must be a positive number');
    }
    if (price.ask.isNaN() || price.ask.lte(0)) {
        errors.push('Ask price must be a positive number');
    }
    if (price.bid.gt(price.ask)) {
        errors.push('Bid price cannot exceed Ask price');
    }
    if (price.currency !== 'EGP') {
        errors.push('Gold price currency must be EGP');
    }
    return errors;
}
function getSpread(price) {
    return price.ask.minus(price.bid);
}
function getSpreadPercentage(price) {
    return price.ask.minus(price.bid).div(price.bid).times(100);
}
function convertGoldUnit(price, targetUnit) {
    const conversionRates = {
        'gram': new decimal_js_1.Decimal(1),
        'ounce': new decimal_js_1.Decimal(31.1035),
        'kilogram': new decimal_js_1.Decimal(1000),
    };
    const fromRate = conversionRates[price.unit];
    const toRate = conversionRates[targetUnit];
    if (!fromRate || !toRate) {
        throw new Error(`Unknown unit: ${price.unit} or ${targetUnit}`);
    }
    const factor = toRate.div(fromRate);
    return {
        ...price,
        bid: price.bid.times(factor),
        ask: price.ask.times(factor),
        unit: targetUnit,
    };
}
//# sourceMappingURL=gold.js.map