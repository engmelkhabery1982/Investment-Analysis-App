"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateCurrencyUnits = calculateCurrencyUnits;
exports.calculateCurrencyLiquidationValue = calculateCurrencyLiquidationValue;
exports.calculateCurrencyInvestment = calculateCurrencyInvestment;
exports.convertCurrencyAmount = convertCurrencyAmount;
const decimal_js_1 = require("decimal.js");
const results_js_1 = require("../domain/results.js");
const date_resolution_js_1 = require("../utils/date-resolution.js");
function calculateCurrencyUnits(paymentAmount, fxAskRate) {
    (0, date_resolution_js_1.validatePositiveRate)(fxAskRate, 'FX Ask Rate');
    (0, date_resolution_js_1.validateNonZeroAmount)(paymentAmount, 'Payment Amount');
    return paymentAmount.div(fxAskRate);
}
function calculateCurrencyLiquidationValue(totalCurrencyUnits, fxBidRate) {
    (0, date_resolution_js_1.validatePositiveRate)(fxBidRate, 'FX Bid Rate');
    (0, date_resolution_js_1.validateNonZeroAmount)(totalCurrencyUnits, 'Total Currency Units');
    return totalCurrencyUnits.times(fxBidRate);
}
function calculateCurrencyInvestment(cashFlows, fxRates, valuationDate, options) {
    if (cashFlows.length === 0) {
        throw new Error('At least one cash flow is required');
    }
    // Validate all cash flows use the same currency
    const firstCurrency = cashFlows[0].currency;
    for (const flow of cashFlows) {
        if (flow.currency !== firstCurrency) {
            throw new Error(`Mixed currencies detected: expected ${firstCurrency}, found ${flow.currency} in cash flow ${flow.id}`);
        }
    }
    const sortedFlows = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
    const sortedRates = [...fxRates].sort((a, b) => a.date.getTime() - b.date.getTime());
    const relevantRates = sortedRates.filter(r => r.baseCurrency === firstCurrency && r.quoteCurrency === options.targetCurrency);
    if (relevantRates.length === 0) {
        throw new Error(`No FX rates found for ${firstCurrency}/${options.targetCurrency}`);
    }
    const traces = [];
    let totalCurrencyUnits = new decimal_js_1.Decimal(0);
    let totalInvested = new decimal_js_1.Decimal(0);
    const rateDataPoints = relevantRates.map(r => ({
        date: r.date,
        value: r,
    }));
    for (const flow of sortedFlows) {
        (0, date_resolution_js_1.validateDateOrder)(flow.date, valuationDate);
        const askResolution = (0, date_resolution_js_1.resolveMarketData)(flow.date, rateDataPoints, options.dateResolutionPolicy, p => p.value.date);
        const fxAskRate = askResolution.value.ask;
        const currencyUnits = calculateCurrencyUnits(flow.amount, fxAskRate);
        totalCurrencyUnits = totalCurrencyUnits.plus(currencyUnits);
        totalInvested = totalInvested.plus(flow.amount);
        const bidResolution = (0, date_resolution_js_1.resolveMarketData)(valuationDate, rateDataPoints, options.dateResolutionPolicy, p => p.value.date);
        const trace = (0, results_js_1.createCurrencyPurchaseTrace)(flow.id, flow.date, flow.amount, flow.currency, fxAskRate, askResolution.sourceDate, options.targetCurrency, currencyUnits, valuationDate, bidResolution.value.bid, bidResolution.sourceDate, new decimal_js_1.Decimal(0), options.dateResolutionPolicy);
        traces.push(trace);
    }
    const bidResolution = (0, date_resolution_js_1.resolveMarketData)(valuationDate, rateDataPoints, options.dateResolutionPolicy, p => p.value.date);
    const fxBidRate = bidResolution.value.bid;
    const liquidationValue = calculateCurrencyLiquidationValue(totalCurrencyUnits, fxBidRate);
    const updatedTraces = traces.map(t => ({
        ...t,
        liquidationValue: t.currencyUnits.times(fxBidRate),
    }));
    const absoluteGainLoss = liquidationValue.minus(totalInvested);
    const percentageReturn = totalInvested.isZero()
        ? new decimal_js_1.Decimal(0)
        : absoluteGainLoss.div(totalInvested).times(100);
    return {
        totalCurrencyUnits,
        totalInvested,
        liquidationValue,
        absoluteGainLoss,
        percentageReturn,
        traces: updatedTraces,
    };
}
function convertCurrencyAmount(amount, rate, direction, side) {
    const rateValue = side === 'bid' ? rate.bid : rate.ask;
    if (direction === 'base-to-quote') {
        return amount.div(rateValue);
    }
    else {
        return amount.times(rateValue);
    }
}
//# sourceMappingURL=currency.js.map