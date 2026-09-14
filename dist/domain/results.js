"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGoldPurchaseTrace = createGoldPurchaseTrace;
exports.createCurrencyPurchaseTrace = createCurrencyPurchaseTrace;
exports.createInflationAdjustmentTrace = createInflationAdjustmentTrace;
exports.calculateAbsoluteGainLoss = calculateAbsoluteGainLoss;
exports.calculatePercentageReturn = calculatePercentageReturn;
exports.calculateAnnualizedReturn = calculateAnnualizedReturn;
exports.createAlternativeInvestmentResult = createAlternativeInvestmentResult;
exports.createInvestmentComparisonResult = createInvestmentComparisonResult;
const common_js_1 = require("./common.js");
const decimal_js_1 = require("decimal.js");
function createGoldPurchaseTrace(paymentId, paymentDate, paymentAmount, goldAskPrice, goldAskDate, goldQuantity, valuationDate, goldBidPrice, goldBidDate, liquidationValue, dateResolutionPolicy) {
    return {
        paymentId,
        paymentDate: (0, common_js_1.normalizeDate)(paymentDate),
        paymentAmount,
        goldAskPrice,
        goldAskDate: (0, common_js_1.normalizeDate)(goldAskDate),
        goldQuantity,
        valuationDate: (0, common_js_1.normalizeDate)(valuationDate),
        goldBidPrice,
        goldBidDate: (0, common_js_1.normalizeDate)(goldBidDate),
        liquidationValue,
        dateResolutionPolicy,
    };
}
function createCurrencyPurchaseTrace(paymentId, paymentDate, paymentAmount, paymentCurrency, fxAskRate, fxAskDate, targetCurrency, currencyUnits, valuationDate, fxBidRate, fxBidDate, liquidationValue, dateResolutionPolicy) {
    return {
        paymentId,
        paymentDate: (0, common_js_1.normalizeDate)(paymentDate),
        paymentAmount,
        paymentCurrency,
        fxAskRate,
        fxAskDate: (0, common_js_1.normalizeDate)(fxAskDate),
        targetCurrency,
        currencyUnits,
        valuationDate: (0, common_js_1.normalizeDate)(valuationDate),
        fxBidRate,
        fxBidDate: (0, common_js_1.normalizeDate)(fxBidDate),
        liquidationValue,
        dateResolutionPolicy,
    };
}
function createInflationAdjustmentTrace(paymentId, paymentDate, paymentAmount, cpiAtPayment, cpiAtPaymentDate, cpiAtValuation, cpiAtValuationDate, inflationFactor, adjustedValue, dateResolutionPolicy) {
    return {
        paymentId,
        paymentDate: (0, common_js_1.normalizeDate)(paymentDate),
        paymentAmount,
        cpiAtPayment,
        cpiAtPaymentDate: (0, common_js_1.normalizeDate)(cpiAtPaymentDate),
        cpiAtValuation,
        cpiAtValuationDate: (0, common_js_1.normalizeDate)(cpiAtValuationDate),
        inflationFactor,
        adjustedValue,
        dateResolutionPolicy,
    };
}
function calculateAbsoluteGainLoss(currentValue, totalInvested) {
    return currentValue.minus(totalInvested);
}
function calculatePercentageReturn(currentValue, totalInvested) {
    if (totalInvested.isZero()) {
        return new decimal_js_1.Decimal(0);
    }
    return currentValue.minus(totalInvested).div(totalInvested).times(100);
}
function calculateAnnualizedReturn(percentageReturn, years) {
    if (years.lte(0)) {
        throw new Error('Years must be positive for annualized return');
    }
    const one = new decimal_js_1.Decimal(1);
    const base = one.plus(percentageReturn.div(100));
    return base.pow(one.div(years)).minus(one).times(100);
}
function createAlternativeInvestmentResult(investmentId, investmentName, assetClass, totalInvested, totalInvestedCurrency, currentValue, currentValueCurrency, valuationDate, options) {
    const absoluteGainLoss = calculateAbsoluteGainLoss(currentValue, totalInvested);
    const percentageReturn = calculatePercentageReturn(currentValue, totalInvested);
    let annualizedReturn;
    if (options?.xirr?.converged && options.xirr.rate.gt(0)) {
        annualizedReturn = options.xirr.rate.times(100);
    }
    return {
        investmentId,
        investmentName,
        assetClass,
        totalInvested,
        totalInvestedCurrency,
        currentValue,
        currentValueCurrency,
        absoluteGainLoss,
        percentageReturn,
        annualizedReturn,
        xirr: options?.xirr,
        valuationDate: (0, common_js_1.normalizeDate)(valuationDate),
        traces: options?.traces || {},
        metadata: options?.metadata,
    };
}
function createInvestmentComparisonResult(baseInvestment, alternatives, baseCurrency, valuationDate) {
    const sorted = [...alternatives].sort((a, b) => b.percentageReturn.minus(a.percentageReturn).toNumber());
    const bestAlternative = sorted[0]?.investmentName || 'None';
    const worstAlternative = sorted[sorted.length - 1]?.investmentName || 'None';
    const bestValue = sorted[0]?.currentValue || new decimal_js_1.Decimal(0);
    const opportunityCost = bestValue.minus(baseInvestment.currentValue);
    return {
        baseInvestment,
        alternatives: sorted,
        valuationDate: (0, common_js_1.normalizeDate)(valuationDate),
        baseCurrency,
        summary: {
            bestAlternative,
            worstAlternative,
            opportunityCost,
            opportunityCostCurrency: baseCurrency,
        },
    };
}
//# sourceMappingURL=results.js.map