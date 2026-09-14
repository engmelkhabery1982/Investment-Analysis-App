"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalculationEngine = void 0;
exports.createCalculationEngine = createCalculationEngine;
const decimal_js_1 = require("decimal.js");
const results_js_1 = require("../domain/results.js");
const gold_js_1 = require("./gold.js");
const currency_js_1 = require("./currency.js");
const inflation_js_1 = require("./inflation.js");
const xirr_js_1 = require("./xirr.js");
class CalculationEngine {
    goldPrices = [];
    fxRates = [];
    cpiRecords = [];
    options;
    constructor(options) {
        this.options = options;
    }
    setGoldPrices(prices) {
        this.goldPrices = [...prices].sort((a, b) => a.date.getTime() - b.date.getTime());
    }
    setFXRates(rates) {
        this.fxRates = [...rates].sort((a, b) => a.date.getTime() - b.date.getTime());
    }
    setCPIRecords(records) {
        this.cpiRecords = [...records].sort((a, b) => a.date.getTime() - b.date.getTime());
    }
    getGoldPrices() {
        return [...this.goldPrices];
    }
    getFXRates() {
        return [...this.fxRates];
    }
    getCPIRecords() {
        return [...this.cpiRecords];
    }
    calculateGoldAlternative(investment, valuationDate) {
        const goldOptions = {
            dateResolutionPolicy: this.options.dateResolutionPolicy,
            goldUnit: 'gram',
        };
        const result = (0, gold_js_1.calculateGoldInvestment)(investment.cashFlows, this.goldPrices, valuationDate, goldOptions);
        const xirr = (0, xirr_js_1.calculateXIRRFromCashFlows)(investment.cashFlows, this.options.xirrOptions);
        return (0, results_js_1.createAlternativeInvestmentResult)(investment.id, investment.name, 'gold', result.totalInvested, 'EGP', result.liquidationValue, 'EGP', valuationDate, {
            xirr,
            traces: { gold: result.traces },
        });
    }
    calculateCurrencyAlternative(investment, targetCurrency, valuationDate) {
        const currencyOptions = {
            dateResolutionPolicy: this.options.dateResolutionPolicy,
            targetCurrency,
        };
        const result = (0, currency_js_1.calculateCurrencyInvestment)(investment.cashFlows, this.fxRates, valuationDate, currencyOptions);
        const xirr = (0, xirr_js_1.calculateXIRRFromCashFlows)(investment.cashFlows, this.options.xirrOptions);
        return (0, results_js_1.createAlternativeInvestmentResult)(investment.id, investment.name, 'currency', result.totalInvested, investment.currency, result.liquidationValue, investment.currency, valuationDate, {
            xirr,
            traces: { currency: result.traces },
        });
    }
    calculateInflationAlternative(investment, valuationDate) {
        const inflationOptions = {
            dateResolutionPolicy: this.options.dateResolutionPolicy,
        };
        const result = (0, inflation_js_1.calculateInflationAdjustedInvestment)(investment.cashFlows, this.cpiRecords, valuationDate, inflationOptions);
        const xirr = (0, xirr_js_1.calculateXIRRFromCashFlows)(investment.cashFlows, this.options.xirrOptions);
        return (0, results_js_1.createAlternativeInvestmentResult)(investment.id, investment.name, 'inflation-indexed', result.totalInvested, 'EGP', result.totalAdjustedValue, 'EGP', valuationDate, {
            xirr,
            traces: { inflation: result.traces },
        });
    }
    calculateRealEstateBase(investment, currentPropertyValue, valuationDate) {
        const totalInvested = investment.cashFlows.reduce((sum, f) => sum.plus(f.amount), new decimal_js_1.Decimal(0));
        const xirr = (0, xirr_js_1.calculateXIRRFromCashFlows)(investment.cashFlows, this.options.xirrOptions);
        return (0, results_js_1.createAlternativeInvestmentResult)(investment.id, investment.name, 'real-estate', totalInvested, investment.currency, currentPropertyValue, investment.currency, valuationDate, { xirr });
    }
    compareAlternatives(baseInvestment, currentPropertyValue, targetCurrencies, valuationDate) {
        const base = this.calculateRealEstateBase(baseInvestment, currentPropertyValue, valuationDate);
        const alternatives = [];
        if (this.goldPrices.length > 0) {
            alternatives.push(this.calculateGoldAlternative(baseInvestment, valuationDate));
        }
        for (const currency of targetCurrencies) {
            const relevantRates = this.fxRates.filter(r => r.baseCurrency === baseInvestment.currency && r.quoteCurrency === currency);
            if (relevantRates.length > 0) {
                alternatives.push(this.calculateCurrencyAlternative(baseInvestment, currency, valuationDate));
            }
        }
        if (this.cpiRecords.length > 0) {
            alternatives.push(this.calculateInflationAlternative(baseInvestment, valuationDate));
        }
        return (0, results_js_1.createInvestmentComparisonResult)(base, alternatives, baseInvestment.currency, valuationDate);
    }
}
exports.CalculationEngine = CalculationEngine;
function createCalculationEngine(options) {
    return new CalculationEngine(options);
}
//# sourceMappingURL=index.js.map