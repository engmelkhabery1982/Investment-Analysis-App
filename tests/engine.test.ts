import { describe, it, expect, beforeEach } from 'vitest';
import { Decimal } from 'decimal.js';
import { CalculationEngine, createCalculationEngine } from '../src/engine/index.js';
import { createInvestment } from '../src/domain/investment.js';
import { createCashFlow } from '../src/domain/cashflow.js';
import { createGoldPrice } from '../src/domain/gold.js';
import { createFXRate } from '../src/domain/fx.js';
import { createCPIRecord } from '../src/domain/cpi.js';
import { DateResolutionPolicy, Currency } from '../src/domain/common.js';

// Helper to create UTC dates
const utcDate = (dateStr: string) => new Date(dateStr + 'T00:00:00.000Z');

describe('Calculation Engine Integration', () => {
  let engine: CalculationEngine;
  
  const createTestFlow = (id: string, date: string, amount: number) => 
    createCashFlow(id, utcDate(date), new Decimal(amount), 'EGP');
  
  const createTestGoldPrice = (date: string, bid: number, ask: number) =>
    createGoldPrice(utcDate(date), new Decimal(bid), new Decimal(ask));
  
  const createTestFXRate = (date: string, bid: number, ask: number) =>
    createFXRate(utcDate(date), 'EGP', 'USD', new Decimal(bid), new Decimal(ask));
  
  const createTestCPI = (date: string, index: number) =>
    createCPIRecord(utcDate(date), new Decimal(index));
  
  beforeEach(() => {
    engine = createCalculationEngine({
      dateResolutionPolicy: 'exact',
    });
  });
  
  describe('Gold Alternative', () => {
    it('should calculate gold alternative correctly', () => {
      const flows = [
        createTestFlow('1', '2024-09-01', 100000),
        createTestFlow('2', '2024-10-01', 50000),
      ];
      
      const investment = createInvestment(
        'inv1', 'Test Property', 'real-estate', 'EGP', flows, utcDate('2024-12-01')
      );
      
      engine.setGoldPrices([
        createTestGoldPrice('2024-09-01', 5000, 5100),
        createTestGoldPrice('2024-10-01', 5200, 5300),
        createTestGoldPrice('2024-12-01', 6000, 6100),
      ]);
      
      const result = engine.calculateGoldAlternative(investment, utcDate('2024-12-01'));
      
      expect(result.assetClass).toBe('gold');
      expect(result.totalInvested.toNumber()).toBe(150000);
      expect(result.currentValue.toDecimalPlaces(1).toNumber()).toBe(174250.8);
      expect(result.absoluteGainLoss.toDecimalPlaces(1).toNumber()).toBe(24250.8);
      expect(result.percentageReturn.toDecimalPlaces(2).toNumber()).toBe(16.17);
      expect(result.traces.gold?.length).toBe(2);
    });
    
    it('should use previous policy when configured', () => {
      const engineWithPrevious = createCalculationEngine({
        dateResolutionPolicy: 'previous',
      });
      
      const flows = [createTestFlow('1', '2024-09-15', 100000)];
      const investment = createInvestment(
        'inv1', 'Test', 'real-estate', 'EGP', flows, utcDate('2024-12-01')
      );
      
      engineWithPrevious.setGoldPrices([
        createTestGoldPrice('2024-09-01', 5000, 5100),
        createTestGoldPrice('2024-09-10', 5050, 5150),
        createTestGoldPrice('2024-12-01', 6000, 6100),
      ]);
      
      const result = engineWithPrevious.calculateGoldAlternative(investment, utcDate('2024-12-01'));
      
      expect(result.traces.gold?.[0].goldAskDate.toISOString().split('T')[0]).toBe('2024-09-10');
    });
  });
  
  describe('Currency Alternative', () => {
    it('should calculate USD alternative correctly', () => {
      const flows = [
        createTestFlow('1', '2024-09-01', 100000),
        createTestFlow('2', '2024-10-01', 50000),
      ];
      
      const investment = createInvestment(
        'inv1', 'Test Property', 'real-estate', 'EGP', flows, utcDate('2024-12-01')
      );
      
      engine.setFXRates([
        createTestFXRate('2024-09-01', 49, 50),
        createTestFXRate('2024-10-01', 50, 51),
        createTestFXRate('2024-12-01', 52, 53),
      ]);
      
      const result = engine.calculateCurrencyAlternative(investment, 'USD', utcDate('2024-12-01'));
      
      expect(result.assetClass).toBe('currency');
      expect(result.totalInvested.toNumber()).toBe(150000);
      expect(result.currentValue.toDecimalPlaces(2).toNumber()).toBe(154980.39);
      expect(result.traces.currency?.length).toBe(2);
    });
    
    it('should only calculate for available currency pairs', () => {
      const flows = [createTestFlow('1', '2024-09-01', 100000)];
      const investment = createInvestment(
        'inv1', 'Test', 'real-estate', 'EGP', flows, utcDate('2024-12-01')
      );
      
      // Only EUR/USD rates, no EGP/USD
      engine.setFXRates([
        createFXRate(utcDate('2024-09-01'), 'EUR', 'USD', new Decimal(1.08), new Decimal(1.10)),
      ]);
      
      // Should not throw, just not create result
      const comparison = engine.compareAlternatives(investment, new Decimal(200000), ['USD'], utcDate('2024-12-01'));
      expect(comparison.alternatives.length).toBe(0);
    });
  });
  
  describe('Inflation Alternative', () => {
    it('should calculate inflation-adjusted alternative correctly', () => {
      const flows = [
        createTestFlow('1', '2024-09-01', 100000),
        createTestFlow('2', '2024-10-01', 50000),
      ];
      
      const investment = createInvestment(
        'inv1', 'Test Property', 'real-estate', 'EGP', flows, utcDate('2024-12-01')
      );
      
      engine.setCPIRecords([
        createTestCPI('2024-09-01', 100),
        createTestCPI('2024-10-01', 102),
        createTestCPI('2024-12-01', 110),
      ]);
      
      const result = engine.calculateInflationAlternative(investment, utcDate('2024-12-01'));
      
      expect(result.assetClass).toBe('inflation-indexed');
      expect(result.totalInvested.toNumber()).toBe(150000);
      expect(result.currentValue.toDecimalPlaces(2).toNumber()).toBe(163921.57);
      expect(result.traces.inflation?.length).toBe(2);
    });
  });
  
  describe('Real Estate Base', () => {
    it('should calculate base real estate investment', () => {
      const flows = [
        createTestFlow('1', '2024-09-01', 100000),
        createTestFlow('2', '2024-10-01', 50000),
      ];
      
      const investment = createInvestment(
        'inv1', 'Test Property', 'real-estate', 'EGP', flows, utcDate('2024-12-01')
      );
      
      const result = engine.calculateRealEstateBase(investment, new Decimal(200000), utcDate('2024-12-01'));
      
      expect(result.assetClass).toBe('real-estate');
      expect(result.totalInvested.toNumber()).toBe(150000);
      expect(result.currentValue.toNumber()).toBe(200000);
      expect(result.absoluteGainLoss.toNumber()).toBe(50000);
    });
  });
  
  describe('Compare Alternatives', () => {
    it('should compare all available alternatives', () => {
      const flows = [
        createTestFlow('1', '2024-09-01', 100000),
        createTestFlow('2', '2024-10-01', 50000),
      ];
      
      const investment = createInvestment(
        'inv1', 'Test Property', 'real-estate', 'EGP', flows, utcDate('2024-12-01')
      );
      
      engine.setGoldPrices([
        createTestGoldPrice('2024-09-01', 5000, 5100),
        createTestGoldPrice('2024-10-01', 5200, 5300),
        createTestGoldPrice('2024-12-01', 6000, 6100),
      ]);
      
      engine.setFXRates([
        createTestFXRate('2024-09-01', 49, 50),
        createTestFXRate('2024-10-01', 50, 51),
        createTestFXRate('2024-12-01', 52, 53),
      ]);
      
      engine.setCPIRecords([
        createTestCPI('2024-09-01', 100),
        createTestCPI('2024-10-01', 102),
        createTestCPI('2024-12-01', 110),
      ]);
      
      const comparison = engine.compareAlternatives(
        investment,
        new Decimal(200000), // current property value
        ['USD'],
        utcDate('2024-12-01')
      );
      
      expect(comparison.baseInvestment.assetClass).toBe('real-estate');
      expect(comparison.alternatives.length).toBe(3); // gold, USD, inflation
      expect(comparison.summary.bestAlternative).toBeDefined();
      expect(comparison.summary.opportunityCost).toBeDefined();
    });
    
    it('should sort alternatives by return descending', () => {
      const flows = [createTestFlow('1', '2024-09-01', 100000)];
      const investment = createInvestment(
        'inv1', 'Test', 'real-estate', 'EGP', flows, utcDate('2024-12-01')
      );
      
      // Gold gives 20% return
      engine.setGoldPrices([
        createTestGoldPrice('2024-09-01', 5000, 5100),
        createTestGoldPrice('2024-12-01', 6120, 6200), // ~20% gain
      ]);
      
      // USD gives 10% return
      engine.setFXRates([
        createTestFXRate('2024-09-01', 50, 51),
        createTestFXRate('2024-12-01', 55, 56), // ~10% gain
      ]);
      
      const comparison = engine.compareAlternatives(
        investment,
        new Decimal(110000), // property gives 10%
        ['USD'],
        utcDate('2024-12-01')
      );
      
      // Gold should be first (highest return)
      expect(comparison.alternatives[0].assetClass).toBe('gold');
      expect(comparison.summary.bestAlternative).toContain('Test');
    });
  });
});