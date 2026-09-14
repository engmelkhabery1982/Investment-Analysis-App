"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateGoldQuantity = calculateGoldQuantity;
exports.calculateGoldLiquidationValue = calculateGoldLiquidationValue;
exports.calculateGoldInvestment = calculateGoldInvestment;
exports.calculateGoldInvestmentSimple = calculateGoldInvestmentSimple;
const decimal_js_1 = require("decimal.js");
const results_js_1 = require("../domain/results.js");
const date_resolution_js_1 = require("../utils/date-resolution.js");
function calculateGoldQuantity(paymentAmount, goldAskPrice) {
    (0, date_resolution_js_1.validatePositiveRate)(goldAskPrice, 'Gold Ask Price');
    (0, date_resolution_js_1.validateNonZeroAmount)(paymentAmount, 'Payment Amount');
    return paymentAmount.div(goldAskPrice);
}
function calculateGoldLiquidationValue(totalGoldQuantity, goldBidPrice) {
    (0, date_resolution_js_1.validatePositiveRate)(goldBidPrice, 'Gold Bid Price');
    (0, date_resolution_js_1.validateNonZeroAmount)(totalGoldQuantity, 'Total Gold Quantity');
    return totalGoldQuantity.times(goldBidPrice);
}
function calculateGoldInvestment(cashFlows, goldPrices, valuationDate, options) {
    const sortedFlows = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
    const sortedPrices = [...goldPrices].sort((a, b) => a.date.getTime() - b.date.getTime());
    const traces = [];
    let totalGoldQuantity = new decimal_js_1.Decimal(0);
    let totalInvested = new decimal_js_1.Decimal(0);
    for (const flow of sortedFlows) {
        (0, date_resolution_js_1.validateDateOrder)(flow.date, valuationDate);
        const priceDataPoints = sortedPrices.map(p => ({
            date: p.date,
            value: p,
        }));
        const askResolution = (0, date_resolution_js_1.resolveMarketData)(flow.date, priceDataPoints, options.dateResolutionPolicy, p => p.value.date);
        const goldAskPrice = askResolution.value.ask;
        const goldQuantity = calculateGoldQuantity(flow.amount, goldAskPrice);
        totalGoldQuantity = totalGoldQuantity.plus(goldQuantity);
        totalInvested = totalInvested.plus(flow.amount);
        const bidResolution = (0, date_resolution_js_1.resolveMarketData)(valuationDate, priceDataPoints, options.dateResolutionPolicy, p => p.value.date);
        const trace = (0, results_js_1.createGoldPurchaseTrace)(flow.id, flow.date, flow.amount, goldAskPrice, askResolution.sourceDate, goldQuantity, valuationDate, bidResolution.value.bid, bidResolution.sourceDate, new decimal_js_1.Decimal(0), options.dateResolutionPolicy);
        traces.push(trace);
    }
    const bidResolution = (0, date_resolution_js_1.resolveMarketData)(valuationDate, sortedPrices.map(p => ({ date: p.date, value: p })), options.dateResolutionPolicy, p => p.value.date);
    const goldBidPrice = bidResolution.value.bid;
    const liquidationValue = calculateGoldLiquidationValue(totalGoldQuantity, goldBidPrice);
    const updatedTraces = traces.map(t => ({
        ...t,
        liquidationValue: t.goldQuantity.times(goldBidPrice),
    }));
    const absoluteGainLoss = liquidationValue.minus(totalInvested);
    const percentageReturn = totalInvested.isZero()
        ? new decimal_js_1.Decimal(0)
        : absoluteGainLoss.div(totalInvested).times(100);
    return {
        totalGoldQuantity,
        totalInvested,
        liquidationValue,
        absoluteGainLoss,
        percentageReturn,
        traces: updatedTraces,
    };
}
function calculateGoldInvestmentSimple(payments, goldAskPrices, goldBidPrice, valuationDate) {
    let totalGold = new decimal_js_1.Decimal(0);
    let totalInvested = new decimal_js_1.Decimal(0);
    for (const payment of payments) {
        const dateKey = payment.date.toISOString().split('T')[0];
        const askPrice = goldAskPrices.get(dateKey);
        if (!askPrice) {
            throw new Error(`No gold ask price for date ${dateKey}`);
        }
        const goldQty = calculateGoldQuantity(payment.amount, askPrice);
        totalGold = totalGold.plus(goldQty);
        totalInvested = totalInvested.plus(payment.amount);
    }
    const liquidationValue = calculateGoldLiquidationValue(totalGold, goldBidPrice);
    return { totalGold, totalInvested, liquidationValue };
}
//# sourceMappingURL=gold.js.map