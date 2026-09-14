import { describe, it, expect, beforeEach } from 'vitest';
import { Decimal } from 'decimal.js';
import { 
  calculateCurrencyUnits,
  calculateCurrencyLiquidationValue,
  calculateCurrencyInvestment,
  convertCurrencyAmount
} from '../src/engine/currency.js';
import { 
  createFXRate,
  FXRate 
} from '../src/domain/fx.js';
import { 
  createCashFlow, 
  CashFlow 
} from '../src/domain/cashflow.js';
import { DateResolutionPolicy } from '../src/domain/common.js';

// Helper to create UTC dates
const utcDate = (dateStr: string) => new Date(dateStr + 'T00:00:00.000Z');

describe('Currency Calculation Engine', () => {
  const createTestFlow = (id: string, date: string, amount: number): CashFlow => 
    createCashFlow(id, utcDate(date), new Decimal(amount), 'EGP');
  
  const createTestFXRate = (date: string, bid: number, ask: number, base: 'EGP' | 'USD' = 'EGP', quote: 'EGP' | 'USD' = 'USD'): FXRate =>
    createFXRate(utcDate(date), base, quote, new Decimal(bid), new Decimal(ask));
  
  describe('calculateCurrencyUnits', () => {
    it('should calculate correct currency units for hand-verifiable example', () => {
      // Payment = 100,000 EGP
      // FX Ask = 50 EGP/USD (bank sells USD)
      // Expected: 2,000 USD
      const paymentAmount = new Decimal(100000);
      const fxAskRate = new Decimal(50);
      
      const units = calculateCurrencyUnits(paymentAmount, fxAskRate);
      
      expect(units.toNumber()).toBe(2000);
    });
    
    it('should handle decimal amounts precisely', () => {
      const paymentAmount = new Decimal('123456.78');
      const fxAskRate = new Decimal('49.75');
      
      const units = calculateCurrencyUnits(paymentAmount, fxAskRate);
      
      expect(units.toDecimalPlaces(4).toNumber()).toBe(2481.5433);
    });
    
    it('should throw on zero ask rate', () => {
      expect(() => calculateCurrencyUnits(new Decimal(1000), new Decimal(0)))
        .toThrow('FX Ask Rate must be a positive number');
    });
  });
  
  describe('calculateCurrencyLiquidationValue', () => {
    it('should calculate correct liquidation value for hand-verifiable example', () => {
      // Total USD = 2,000
      // FX Bid = 52 EGP/USD (bank buys USD)
      // Expected: 104,000 EGP
      const totalUnits = new Decimal(2000);
      const fxBidRate = new Decimal(52);
      
      const value = calculateCurrencyLiquidationValue(totalUnits, fxBidRate);
      
      expect(value.toNumber()).toBe(104000);
    });
    
    it('should handle spread correctly (buy at ask, sell at bid)', () => {
      // This demonstrates the bid/ask spread cost
      const paymentAmount = new Decimal(100000);
      const askRate = new Decimal(50);   // Buy USD at 50
      const bidRate = new Decimal(52);   // Sell USD at 52
      
      const units = calculateCurrencyUnits(paymentAmount, askRate);
      const liquidation = calculateCurrencyLiquidationValue(units, bidRate);
      
      // 100000 / 50 * 52 = 104000
      // Gain of 4000 EGP from currency appreciation
      expect(liquidation.toNumber()).toBe(104000);
    });
  });
  
  describe('calculateCurrencyInvestment', () => {
    it('should calculate correctly with exact date matches', () => {
      const flows: CashFlow[] = [
        createTestFlow('1', '2024-09-01', 100000),
        createTestFlow('2', '2024-10-01', 50000),
      ];
      
      const rates: FXRate[] = [
        createTestFXRate('2024-09-01', 49, 50),
        createTestFXRate('2024-10-01', 50, 51),
        createTestFXRate('2024-12-01', 52, 53), // valuation
      ];
      
      const valuationDate = utcDate('2024-12-01');
      
      const result = calculateCurrencyInvestment(flows, rates, valuationDate, {
        dateResolutionPolicy: 'exact',
        targetCurrency: 'USD',
      });
      
      // Payment 1: 100000 / 50 = 2000 USD
      // Payment 2: 50000 / 51 = 980.39 USD
      // Total: 2980.39 USD
      // Liquidation: 2980.39 * 52 = 154980.28 EGP
      
      expect(result.totalCurrencyUnits.toDecimalPlaces(2).toNumber()).toBe(2980.39);
      expect(result.totalInvested.toNumber()).toBe(150000);
      expect(result.liquidationValue.toDecimalPlaces(2).toNumber()).toBe(154980.39);
      expect(result.absoluteGainLoss.toDecimalPlaces(2).toNumber()).toBe(4980.39);
      expect(result.percentageReturn.toDecimalPlaces(2).toNumber()).toBe(3.32);
    });
    
    it('should use previous date policy', () => {
      const flows: CashFlow[] = [
        createTestFlow('1', '2024-09-15', 100000),
      ];
      
      const rates: FXRate[] = [
        createTestFXRate('2024-09-01', 49, 50),
        createTestFXRate('2024-09-10', 49.5, 50.5),
        createTestFXRate('2024-12-01', 52, 53),
      ];
      
      const valuationDate = utcDate('2024-12-01');
      
      const result = calculateCurrencyInvestment(flows, rates, valuationDate, {
        dateResolutionPolicy: 'previous',
        targetCurrency: 'USD',
      });
      
      // Uses 2024-09-10 rate
      expect(result.traces[0].fxAskDate.toISOString().split('T')[0]).toBe('2024-09-10');
      expect(result.totalCurrencyUnits.toDecimalPlaces(2).toNumber()).toBe(1980.20);
    });
    
    it('should filter rates by currency pair', () => {
      const flows: CashFlow[] = [
        createTestFlow('1', '2024-09-01', 100000),
      ];
      
      const rates: FXRate[] = [
        createTestFXRate('2024-09-01', 49, 50, 'EGP', 'USD'),
        createTestFXRate('2024-09-01', 0.85, 0.86, 'EUR', 'USD'), // Different pair
        createTestFXRate('2024-12-01', 52, 53, 'EGP', 'USD'),
      ];
      
      const valuationDate = utcDate('2024-12-01');
      
      const result = calculateCurrencyInvestment(flows, rates, valuationDate, {
        dateResolutionPolicy: 'exact',
        targetCurrency: 'USD',
      });
      
      expect(result.totalCurrencyUnits.toNumber()).toBe(2000);
    });
    
    it('should throw when no rates for currency pair', () => {
      const flows: CashFlow[] = [
        createTestFlow('1', '2024-09-01', 100000),
      ];
      
      const rates: FXRate[] = [
        createTestFXRate('2024-09-01', 0.85, 0.86, 'EUR', 'USD'),
      ];
      
      const valuationDate = utcDate('2024-12-01');
      
      expect(() => calculateCurrencyInvestment(flows, rates, valuationDate, {
        dateResolutionPolicy: 'exact',
        targetCurrency: 'USD',
      })).toThrow('No FX rates found for EGP/USD');
    });
  });
  
  describe('convertCurrencyAmount', () => {
    it('should convert base to quote using ask', () => {
      const rate = createTestFXRate('2024-09-01', 49, 50, 'EGP', 'USD');
      const amount = new Decimal(100000);
      
      const result = convertCurrencyAmount(amount, rate, 'base-to-quote', 'ask');
      
      // 100000 / 50 = 2000 USD
      expect(result.toNumber()).toBe(2000);
    });
    
    it('should convert quote to base using bid', () => {
      const rate = createTestFXRate('2024-09-01', 49, 50, 'EGP', 'USD');
      const amount = new Decimal(2000);
      
      const result = convertCurrencyAmount(amount, rate, 'quote-to-base', 'bid');
      
      // 2000 * 49 = 98000 EGP
      expect(result.toNumber()).toBe(98000);
    });
  });
});