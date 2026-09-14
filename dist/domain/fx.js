"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFXRate = createFXRate;
exports.validateFXRate = validateFXRate;
exports.getSpread = getSpread;
exports.getSpreadPercentage = getSpreadPercentage;
exports.invertRate = invertRate;
exports.convertCurrency = convertCurrency;
exports.getPairKey = getPairKey;
const common_js_1 = require("./common.js");
const decimal_js_1 = require("decimal.js");
function createFXRate(date, baseCurrency, quoteCurrency, bid, ask, source) {
    return {
        date: (0, common_js_1.normalizeDate)(date),
        baseCurrency,
        quoteCurrency,
        bid,
        ask,
        source,
    };
}
function validateFXRate(rate) {
    const errors = [];
    if (!(0, common_js_1.isValidDate)(rate.date)) {
        errors.push('FX rate must have a valid date');
    }
    if (rate.bid.isNaN() || rate.bid.lte(0)) {
        errors.push('Bid rate must be a positive number');
    }
    if (rate.ask.isNaN() || rate.ask.lte(0)) {
        errors.push('Ask rate must be a positive number');
    }
    if (rate.bid.gt(rate.ask)) {
        errors.push('Bid rate cannot exceed Ask rate');
    }
    if (rate.baseCurrency === rate.quoteCurrency) {
        errors.push('Base and quote currencies must be different');
    }
    return errors;
}
function getSpread(rate) {
    return rate.ask.minus(rate.bid);
}
function getSpreadPercentage(rate) {
    return rate.ask.minus(rate.bid).div(rate.bid).times(100);
}
function invertRate(rate) {
    return {
        ...rate,
        baseCurrency: rate.quoteCurrency,
        quoteCurrency: rate.baseCurrency,
        bid: new decimal_js_1.Decimal(1).div(rate.ask),
        ask: new decimal_js_1.Decimal(1).div(rate.bid),
    };
}
function convertCurrency(amount, rate, direction, side) {
    const rateValue = side === 'bid' ? rate.bid : rate.ask;
    if (direction === 'base-to-quote') {
        return amount.div(rateValue);
    }
    else {
        return amount.times(rateValue);
    }
}
function getPairKey(base, quote) {
    return `${base}/${quote}`;
}
//# sourceMappingURL=fx.js.map