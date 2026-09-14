"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPairKey = exports.convertCurrency = exports.invertRate = exports.getFXSpreadPercentage = exports.getFXSpread = exports.validateFXRate = exports.createFXRate = exports.convertGoldUnit = exports.getGoldSpreadPercentage = exports.getGoldSpread = exports.validateGoldPrice = exports.createGoldPrice = void 0;
__exportStar(require("./common.js"), exports);
__exportStar(require("./cashflow.js"), exports);
__exportStar(require("./cpi.js"), exports);
__exportStar(require("./investment.js"), exports);
__exportStar(require("./results.js"), exports);
// Explicit re-exports to resolve ambiguity between gold.ts and fx.ts
var gold_js_1 = require("./gold.js");
Object.defineProperty(exports, "createGoldPrice", { enumerable: true, get: function () { return gold_js_1.createGoldPrice; } });
Object.defineProperty(exports, "validateGoldPrice", { enumerable: true, get: function () { return gold_js_1.validateGoldPrice; } });
Object.defineProperty(exports, "getGoldSpread", { enumerable: true, get: function () { return gold_js_1.getSpread; } });
Object.defineProperty(exports, "getGoldSpreadPercentage", { enumerable: true, get: function () { return gold_js_1.getSpreadPercentage; } });
Object.defineProperty(exports, "convertGoldUnit", { enumerable: true, get: function () { return gold_js_1.convertGoldUnit; } });
var fx_js_1 = require("./fx.js");
Object.defineProperty(exports, "createFXRate", { enumerable: true, get: function () { return fx_js_1.createFXRate; } });
Object.defineProperty(exports, "validateFXRate", { enumerable: true, get: function () { return fx_js_1.validateFXRate; } });
Object.defineProperty(exports, "getFXSpread", { enumerable: true, get: function () { return fx_js_1.getSpread; } });
Object.defineProperty(exports, "getFXSpreadPercentage", { enumerable: true, get: function () { return fx_js_1.getSpreadPercentage; } });
Object.defineProperty(exports, "invertRate", { enumerable: true, get: function () { return fx_js_1.invertRate; } });
Object.defineProperty(exports, "convertCurrency", { enumerable: true, get: function () { return fx_js_1.convertCurrency; } });
Object.defineProperty(exports, "getPairKey", { enumerable: true, get: function () { return fx_js_1.getPairKey; } });
//# sourceMappingURL=index.js.map