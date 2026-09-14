export * from './common.js';
export * from './cashflow.js';
export * from './cpi.js';
export * from './investment.js';
export * from './results.js';

// Explicit re-exports to resolve ambiguity between gold.ts and fx.ts
export {
  type GoldPrice,
  type GoldPriceRecord,
  createGoldPrice,
  validateGoldPrice,
  getSpread as getGoldSpread,
  getSpreadPercentage as getGoldSpreadPercentage,
  convertGoldUnit,
} from './gold.js';

export {
  type FXRate,
  type FXRateRecord,
  createFXRate,
  validateFXRate,
  getSpread as getFXSpread,
  getSpreadPercentage as getFXSpreadPercentage,
  invertRate,
  convertCurrency,
  getPairKey,
} from './fx.js';