import { describe, it, expect, beforeEach } from 'vitest';
import { Decimal } from 'decimal.js';
import { 
  calculateInflationFactor,
  adjustForInflation,
  calculateInflationAdjustedInvestment,
  calculateRealReturn,
  calculateCumulativeInflation,
  annualizeInflation
} from '../src/engine/inflation.js';
import { 
  createCPIRecord,
  CPIRecord 
} from '../src/domain/cpi.js';
import { 
  createCashFlow, 
  CashFlow 
} from '../src/domain/cashflow.js';
import { DateResolutionPolicy } from '../src/domain/common.js';

// Helper to create UTC dates
const utcDate = (dateStr: string) => new Date(dateStr + 'T00:00:00.000Z');

describe('Inflation Calculation Engine', () => {
  const createTestFlow = (id: string, date: string, amount: number): CashFlow => 
    createCashFlow(id, utcDate(date), new Decimal(amount), 'EGP');
  
  const createTestCPI = (date: string, index: number): CPIRecord =>
    createCPIRecord(utcDate(date), new Decimal(index));
  
  describe('calculateInflationFactor', () => {
    it('should calculate correct factor for hand-verifiable example', () => {
      // CPI at payment = 100
      // CPI at valuation = 120
      // Factor = 120/100 = 1.2
      const cpiPayment = new Decimal(100);
      const cpiValuation = new Decimal(120);
      
      const factor = calculateInflationFactor(cpiPayment, cpiValuation);
      
      expect(factor.toNumber()).toBe(1.2);
    });
    
    it('should throw on zero payment CPI', () => {
      expect(() => calculateInflationFactor(new Decimal(0), new Decimal(120)))
        .toThrow('CPI at Payment must be a positive number');
    });
  });
  
  describe('adjustForInflation', () => {
    it('should calculate correct adjusted value for hand-verifiable example', () => {
      // Payment = 100,000 EGP
      // CPI at payment = 100
      // CPI at valuation = 120
      // Adjusted = 100000 * 120/100 = 120,000 EGP
      const historicalAmount = new Decimal(100000);
      const cpiPayment = new Decimal(100);
      const cpiValuation = new Decimal(120);
      
      const adjusted = adjustForInflation(historicalAmount, cpiPayment, cpiValuation);
      
      expect(adjusted.toNumber()).toBe(120000);
    });

    it('should calculate correct adjusted value for CPI 200 to 250', () => {
      // Payment = 100,000 EGP
      // CPI at payment = 200
      // CPI at valuation = 250
      // Adjusted = 100000 * 250/200 = 125,000 EGP
      const historicalAmount = new Decimal(100000);
      const cpiPayment = new Decimal(200);
      const cpiValuation = new Decimal(250);
      
      const adjusted = adjustForInflation(historicalAmount, cpiPayment, cpiValuation);
      
      expect(adjusted.toNumber()).toBe(125000);
    });
  });
  
  describe('calculateInflationAdjustedInvestment', () => {
    it('should calculate correctly with exact date matches', () => {
      const flows: CashFlow[] = [
        createTestFlow('1', '2024-09-01', 100000),
        createTestFlow('2', '2024-10-01', 50000),
      ];
      
      const cpiRecords: CPIRecord[] = [
        createTestCPI('2024-09-01', 100),
        createTestCPI('2024-10-01', 102),
        createTestCPI('2024-12-01', 110), // valuation
      ];
      
      const valuationDate = utcDate('2024-12-01');
      
      const result = calculateInflationAdjustedInvestment(flows, cpiRecords, valuationDate, {
        dateResolutionPolicy: 'exact',
      });
      
      // Payment 1: 100000 * 110/100 = 110,000
      // Payment 2: 50000 * 110/102 = 53,921.57
      // Total adjusted: 163,921.57
      // Total invested: 150,000
      // Gain: 13,921.57 (9.28%)
      
      expect(result.totalAdjustedValue.toDecimalPlaces(2).toNumber()).toBe(163921.57);
      expect(result.totalInvested.toNumber()).toBe(150000);
      expect(result.absoluteGainLoss.toDecimalPlaces(2).toNumber()).toBe(13921.57);
      expect(result.percentageReturn.toDecimalPlaces(2).toNumber()).toBe(9.28);
    });
    
    it('should use previous date policy', () => {
      const flows: CashFlow[] = [
        createTestFlow('1', '2024-09-15', 100000),
      ];
      
      const cpiRecords: CPIRecord[] = [
        createTestCPI('2024-09-01', 100),
        createTestCPI('2024-09-10', 101),
        createTestCPI('2024-12-01', 110),
      ];
      
      const valuationDate = utcDate('2024-12-01');
      
      const result = calculateInflationAdjustedInvestment(flows, cpiRecords, valuationDate, {
        dateResolutionPolicy: 'previous',
      });
      
      // Uses 2024-09-10 CPI = 101
      // 100000 * 110/101 = 108,910.89
      expect(result.traces[0].cpiAtPaymentDate.toISOString().split('T')[0]).toBe('2024-09-10');
      expect(result.totalAdjustedValue.toDecimalPlaces(2).toNumber()).toBe(108910.89);
    });
    
    it('should record trace with correct CPI dates', () => {
      const flows: CashFlow[] = [
        createTestFlow('1', '2024-09-01', 100000),
      ];
      
      const cpiRecords: CPIRecord[] = [
        createTestCPI('2024-09-01', 100),
        createTestCPI('2024-12-01', 110),
      ];
      
      const valuationDate = utcDate('2024-12-01');
      
      const result = calculateInflationAdjustedInvestment(flows, cpiRecords, valuationDate, {
        dateResolutionPolicy: 'exact',
      });
      
      const trace = result.traces[0];
      expect(trace.paymentId).toBe('1');
      expect(trace.paymentAmount.toNumber()).toBe(100000);
      expect(trace.cpiAtPayment.toNumber()).toBe(100);
      expect(trace.cpiAtValuation.toNumber()).toBe(110);
      expect(trace.inflationFactor.toNumber()).toBe(1.1);
      expect(trace.adjustedValue.toNumber()).toBe(110000);
    });
  });
  
  describe('calculateRealReturn', () => {
    it('should calculate real return from nominal and inflation', () => {
      // Nominal return = 20%
      // Inflation = 10%
      // Real = (1.20 / 1.10) - 1 = 9.09%
      const nominalReturn = new Decimal(20);
      const inflationRate = new Decimal(10);
      
      const real = calculateRealReturn(nominalReturn, inflationRate);
      
      expect(real.toDecimalPlaces(2).toNumber()).toBe(9.09);
    });
  });
  
  describe('calculateCumulativeInflation', () => {
    it('should calculate cumulative inflation percentage', () => {
      const cpiStart = new Decimal(100);
      const cpiEnd = new Decimal(120);
      
      const cumulative = calculateCumulativeInflation(cpiStart, cpiEnd);
      
      expect(cumulative.toNumber()).toBe(20);
    });
  });
  
  describe('annualizeInflation', () => {
    it('should annualize cumulative inflation', () => {
      // 20% over 2 years = ~9.54% per year
      const cumulative = new Decimal(20);
      const years = new Decimal(2);
      
      const annualized = annualizeInflation(cumulative, years);
      
      expect(annualized.toDecimalPlaces(2).toNumber()).toBe(9.54);
    });
    
    it('should throw on zero or negative years', () => {
      expect(() => annualizeInflation(new Decimal(20), new Decimal(0)))
        .toThrow('Years must be positive');
    });
  });
});