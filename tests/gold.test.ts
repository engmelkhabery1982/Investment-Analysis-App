import { describe, it, expect, beforeEach } from 'vitest';
import { Decimal } from 'decimal.js';
import { 
  calculateGoldQuantity,
  calculateGoldLiquidationValue,
  calculateGoldInvestment,
  calculateGoldInvestmentSimple 
} from '../src/engine/gold.js';
import { 
  createGoldPrice,
  GoldPrice 
} from '../src/domain/gold.js';
import { 
  createCashFlow, 
  CashFlow 
} from '../src/domain/cashflow.js';
import { DateResolutionPolicy } from '../src/domain/common.js';

// Helper to create UTC dates
const utcDate = (dateStr: string) => new Date(dateStr + 'T00:00:00.000Z');

describe('Gold Calculation Engine', () => {
  const createTestFlow = (id: string, date: string, amount: number): CashFlow => 
    createCashFlow(id, utcDate(date), new Decimal(amount), 'EGP');
  
  const createTestGoldPrice = (date: string, bid: number, ask: number): GoldPrice =>
    createGoldPrice(utcDate(date), new Decimal(bid), new Decimal(ask));
  
  describe('calculateGoldQuantity', () => {
    it('should calculate correct gold quantity for hand-verifiable example', () => {
      // Payment = 100,000 EGP
      // Gold Ask = 5,000 EGP/g
      // Expected: 20 g
      const paymentAmount = new Decimal(100000);
      const goldAskPrice = new Decimal(5000);
      
      const quantity = calculateGoldQuantity(paymentAmount, goldAskPrice);
      
      expect(quantity.toNumber()).toBe(20);
    });
    
    it('should handle decimal amounts precisely', () => {
      const paymentAmount = new Decimal('123456.78');
      const goldAskPrice = new Decimal('5123.45');
      
      const quantity = calculateGoldQuantity(paymentAmount, goldAskPrice);
      
      // 123456.78 / 5123.45 = 24.0964...
      expect(quantity.toDecimalPlaces(4).toNumber()).toBe(24.0964);
    });
    
    it('should throw on zero ask price', () => {
      expect(() => calculateGoldQuantity(new Decimal(1000), new Decimal(0)))
        .toThrow('Gold Ask Price must be a positive number');
    });
    
    it('throw on negative ask price', () => {
      expect(() => calculateGoldQuantity(new Decimal(1000), new Decimal(-100)))
        .toThrow('Gold Ask Price must be a positive number');
    });
    
    it('should throw on zero payment amount', () => {
      expect(() => calculateGoldQuantity(new Decimal(0), new Decimal(5000)))
        .toThrow('Payment Amount cannot be zero');
    });
  });
  
  describe('calculateGoldLiquidationValue', () => {
    it('should calculate correct liquidation value for hand-verifiable example', () => {
      // Total Gold = 20 g
      // Gold Bid = 6,000 EGP/g
      // Expected: 120,000 EGP
      const totalGold = new Decimal(20);
      const goldBidPrice = new Decimal(6000);
      
      const value = calculateGoldLiquidationValue(totalGold, goldBidPrice);
      
      expect(value.toNumber()).toBe(120000);
    });
    
    it('should handle decimal quantities precisely', () => {
      const totalGold = new Decimal('24.0964');
      const goldBidPrice = new Decimal('5200.50');
      
      const value = calculateGoldLiquidationValue(totalGold, goldBidPrice);
      
      expect(value.toDecimalPlaces(2).toNumber()).toBe(125313.33);
    });
    
    it('should throw on zero bid price', () => {
      expect(() => calculateGoldLiquidationValue(new Decimal(20), new Decimal(0)))
        .toThrow('Gold Bid Price must be a positive number');
    });
  });
  
  describe('calculateGoldInvestment', () => {
    it('should calculate correctly with exact date matches', () => {
      // Two payments on different dates
      const flows: CashFlow[] = [
        createTestFlow('1', '2024-09-01', 100000),
        createTestFlow('2', '2024-10-01', 50000),
      ];
      
      const prices: GoldPrice[] = [
        createTestGoldPrice('2024-09-01', 5000, 5100),
        createTestGoldPrice('2024-10-01', 5200, 5300),
        createTestGoldPrice('2024-12-01', 6000, 6100), // valuation date
      ];
      
      const valuationDate = utcDate('2024-12-01');
      
      const result = calculateGoldInvestment(flows, prices, valuationDate, {
        dateResolutionPolicy: 'exact',
        goldUnit: 'gram',
      });
      
      // Payment 1: 100000 / 5100 = 19.6078 g
      // Payment 2: 50000 / 5300 = 9.4340 g
      // Total: 29.0418 g
      // Liquidation: 29.0418 * 6000 = 174250.8
      
      expect(result.totalGoldQuantity.toDecimalPlaces(4).toNumber()).toBe(29.0418);
      expect(result.totalInvested.toNumber()).toBe(150000);
      expect(result.liquidationValue.toDecimalPlaces(1).toNumber()).toBe(174250.8);
      expect(result.absoluteGainLoss.toDecimalPlaces(1).toNumber()).toBe(24250.8);
      expect(result.percentageReturn.toDecimalPlaces(2).toNumber()).toBe(16.17);
      expect(result.traces.length).toBe(2);
    });
    
    it('should use previous date policy when exact date not available', () => {
      const flows: CashFlow[] = [
        createTestFlow('1', '2024-09-15', 100000), // No exact price on 15th
      ];
      
      const prices: GoldPrice[] = [
        createTestGoldPrice('2024-09-01', 5000, 5100),
        createTestGoldPrice('2024-09-10', 5050, 5150),
        createTestGoldPrice('2024-12-01', 6000, 6100),
      ];
      
      const valuationDate = utcDate('2024-12-01');
      
      const result = calculateGoldInvestment(flows, prices, valuationDate, {
        dateResolutionPolicy: 'previous',
        goldUnit: 'gram',
      });
      
      // Should use 2024-09-10 price (previous available)
      // 100000 / 5150 = 19.4175 g
      expect(result.totalGoldQuantity.toDecimalPlaces(4).toNumber()).toBe(19.4175);
      expect(result.traces[0].goldAskDate.toISOString().split('T')[0]).toBe('2024-09-10');
    });
    
    it('should use nearest date policy', () => {
      const flows: CashFlow[] = [
        createTestFlow('1', '2024-09-15', 100000),
      ];
      
      const prices: GoldPrice[] = [
        createTestGoldPrice('2024-09-01', 5000, 5100),
        createTestGoldPrice('2024-09-20', 5200, 5300),
        createTestGoldPrice('2024-12-01', 6000, 6100),
      ];
      
      const valuationDate = utcDate('2024-12-01');
      
      const result = calculateGoldInvestment(flows, prices, valuationDate, {
        dateResolutionPolicy: 'nearest',
        goldUnit: 'gram',
      });
      
      // Nearest to 15th is 20th (5 days vs 14 days)
      expect(result.traces[0].goldAskDate.toISOString().split('T')[0]).toBe('2024-09-20');
      expect(result.totalGoldQuantity.toDecimalPlaces(4).toNumber()).toBe(18.8679);
    });
    
    it('should throw with exact policy when date not found', () => {
      const flows: CashFlow[] = [
        createTestFlow('1', '2024-09-15', 100000),
      ];
      
      const prices: GoldPrice[] = [
        createTestGoldPrice('2024-09-01', 5000, 5100),
        createTestGoldPrice('2024-12-01', 6000, 6100),
      ];
      
      const valuationDate = utcDate('2024-12-01');
      
      expect(() => calculateGoldInvestment(flows, prices, valuationDate, {
        dateResolutionPolicy: 'exact',
        goldUnit: 'gram',
      })).toThrow('No exact market data date found');
    });
    
    it('should throw when valuation date before payment date', () => {
      const flows: CashFlow[] = [
        createTestFlow('1', '2024-12-01', 100000),
      ];
      
      const prices: GoldPrice[] = [
        createTestGoldPrice('2024-12-01', 5000, 5100),
      ];
      
      const valuationDate = utcDate('2024-09-01'); // Before payment
      
      expect(() => calculateGoldInvestment(flows, prices, valuationDate, {
        dateResolutionPolicy: 'exact',
        goldUnit: 'gram',
      })).toThrow('cannot be after valuation date');
    });
    
    it('should record trace with correct bid/ask dates', () => {
      const flows: CashFlow[] = [
        createTestFlow('1', '2024-09-01', 100000),
      ];
      
      const prices: GoldPrice[] = [
        createTestGoldPrice('2024-09-01', 5000, 5100),
        createTestGoldPrice('2024-12-01', 6000, 6100),
      ];
      
      const valuationDate = utcDate('2024-12-01');
      
      const result = calculateGoldInvestment(flows, prices, valuationDate, {
        dateResolutionPolicy: 'exact',
        goldUnit: 'gram',
      });
      
      const trace = result.traces[0];
      expect(trace.paymentId).toBe('1');
      expect(trace.paymentAmount.toNumber()).toBe(100000);
      expect(trace.goldAskPrice.toNumber()).toBe(5100);
      expect(trace.goldBidPrice.toNumber()).toBe(6000);
      expect(trace.goldAskDate.toISOString().split('T')[0]).toBe('2024-09-01');
      expect(trace.goldBidDate.toISOString().split('T')[0]).toBe('2024-12-01');
      expect(trace.liquidationValue.toNumber()).toBeCloseTo(117647, 0); // 19.6078 * 6000
    });
  });
  
  describe('calculateGoldInvestmentSimple', () => {
    it('should work with simple map-based prices', () => {
      const payments = [
        { date: utcDate('2024-09-01'), amount: new Decimal(100000) },
        { date: utcDate('2024-10-01'), amount: new Decimal(50000) },
      ];
      
      const goldAskPrices = new Map<string, Decimal>([
        ['2024-09-01', new Decimal(5100)],
        ['2024-10-01', new Decimal(5300)],
      ]);
      
      const goldBidPrice = new Decimal(6000);
      const valuationDate = utcDate('2024-12-01');
      
      const result = calculateGoldInvestmentSimple(
        payments,
        goldAskPrices,
        goldBidPrice,
        valuationDate
      );
      
      expect(result.totalGold.toDecimalPlaces(4).toNumber()).toBe(29.0418);
      expect(result.totalInvested.toNumber()).toBe(150000);
      expect(result.liquidationValue.toDecimalPlaces(1).toNumber()).toBe(174250.8);
    });
    
    it('should handle multiple installments with different Ask prices and one valuation Bid', () => {
      // Multiple payments at different Ask prices
      const payments = [
        { date: utcDate('2024-01-01'), amount: new Decimal(100000) },  // Ask: 5000
        { date: utcDate('2024-04-01'), amount: new Decimal(100000) },  // Ask: 5500
        { date: utcDate('2024-07-01'), amount: new Decimal(100000) },  // Ask: 6000
      ];
      
      const goldAskPrices = new Map<string, Decimal>([
        ['2024-01-01', new Decimal(5000)],
        ['2024-04-01', new Decimal(5500)],
        ['2024-07-01', new Decimal(6000)],
      ]);
      
      // Single valuation Bid price
      const goldBidPrice = new Decimal(6500);
      const valuationDate = utcDate('2024-12-01');
      
      const result = calculateGoldInvestmentSimple(
        payments,
        goldAskPrices,
        goldBidPrice,
        valuationDate
      );
      
      // Payment 1: 100000 / 5000 = 20 g
      // Payment 2: 100000 / 5500 = 18.1818 g
      // Payment 3: 100000 / 6000 = 16.6667 g
      // Total gold: 54.8485 g
      // Liquidation: 54.8485 * 6500 = 356,515.25 EGP
      // Total invested: 300,000 EGP
      // Gain: 56,515.25 EGP (18.84%)
      
      expect(result.totalGold.toDecimalPlaces(4).toNumber()).toBe(54.8485);
      expect(result.totalInvested.toNumber()).toBe(300000);
      expect(result.liquidationValue.toDecimalPlaces(2).toNumber()).toBe(356515.15);
    });

    it('should throw when ask price missing for payment date', () => {
      const payments = [
        { date: utcDate('2024-09-01'), amount: new Decimal(100000) },
      ];
      
      const goldAskPrices = new Map<string, Decimal>([
        ['2024-10-01', new Decimal(5300)],
      ]);
      
      expect(() => calculateGoldInvestmentSimple(
        payments,
        goldAskPrices,
        new Decimal(6000),
        utcDate('2024-12-01')
      )).toThrow('No gold ask price for date 2024-09-01');
    });
  });
});