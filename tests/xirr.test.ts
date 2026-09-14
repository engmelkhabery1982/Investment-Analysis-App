import { describe, it, expect, beforeEach } from 'vitest';
import { Decimal } from 'decimal.js';
import { 
  calculateXNPV,
  calculateXIRR,
  calculateXIRRFromCashFlows,
  calculateXNPVFromCashFlows,
  prepareXIRRInputs,
  validateXIRRInputs,
  XIRRInput
} from '../src/engine/xirr.js';
import { 
  createCashFlow, 
  CashFlow 
} from '../src/domain/cashflow.js';

// Helper to create UTC dates
const utcDate = (dateStr: string) => new Date(dateStr + 'T00:00:00.000Z');

describe('XIRR/XNPV Engine', () => {
  const createTestFlow = (id: string, date: string, amount: number): CashFlow => 
    createCashFlow(id, utcDate(date), new Decimal(amount), 'EGP');
  
  const createXIRRInput = (date: string, amount: number): XIRRInput => ({
    date: utcDate(date),
    amount: new Decimal(amount),
  });
  
  describe('prepareXIRRInputs', () => {
    it('should filter zero amounts and sort by date', () => {
      const flows: CashFlow[] = [
        createTestFlow('1', '2024-09-01', 100000),
        createTestFlow('2', '2024-08-01', 0),
        createTestFlow('3', '2024-10-01', -50000),
      ];
      
      const inputs = prepareXIRRInputs(flows);
      
      expect(inputs.length).toBe(2);
      // Zero amount is filtered out, so first date is 2024-09-01
      expect(inputs[0].date.toISOString().split('T')[0]).toBe('2024-09-01');
      expect(inputs[1].date.toISOString().split('T')[0]).toBe('2024-10-01');
    });
  });
  
  describe('calculateXNPV', () => {
    it('should calculate NPV correctly for simple case', () => {
      // Invest 100,000 on day 0, receive 110,000 after exactly 365 days (non-leap year)
      // At 10% discount rate: NPV = -100000 + 110000/1.1 = 0
      const inputs: XIRRInput[] = [
        createXIRRInput('2023-01-01', -100000),
        createXIRRInput('2024-01-01', 110000),
      ];
      
      const npv = calculateXNPV(inputs, new Decimal(0.10));
      
      // Exactly 365 days = 1 year
      // NPV = -100000 + 110000 / 1.1^1 = 0
      expect(npv.toDecimalPlaces(1).toNumber()).toBeCloseTo(0, 1);
    });
    
it('should calculate NPV with multiple cash flows', () => {
      const inputs: XIRRInput[] = [
        createXIRRInput('2022-01-01', -100000),
        createXIRRInput('2022-07-02', -50000), // 183 days
        createXIRRInput('2023-01-01', 180000), // 365 days (non-leap year)
      ];
      
      const npv = calculateXNPV(inputs, new Decimal(0.10));
      
      // Year fractions: 0, 183/365=0.5014, 365/365=1.0
      // NPV = -100000 + -50000/1.1^0.5014 + 180000/1.1^1
      expect(npv.toDecimalPlaces(1).toNumber()).toBeCloseTo(15957, 0);
    });
    
    it('should return 0 for empty inputs', () => {
      const npv = calculateXNPV([], new Decimal(0.10));
      expect(npv.toNumber()).toBe(0);
    });
  });
  
  describe('calculateXIRR', () => {
    it('should find correct IRR for simple investment', () => {
      // Invest 100,000, get 110,000 after exactly 365 days (non-leap year)
      const inputs: XIRRInput[] = [
        createXIRRInput('2023-01-01', -100000),
        createXIRRInput('2024-01-01', 110000),
      ];
      
      const result = calculateXIRR(inputs, { tolerance: new Decimal('1e-8') });
      
      expect(result.converged).toBe(true);
      expect(result.rate.toDecimalPlaces(4).toNumber()).toBeCloseTo(0.10, 3);
      expect(result.iterations).toBeGreaterThan(0);
    });
    
    it('should find IRR for multiple cash flows', () => {
      // Classic example: -10000, +3000, +4000, +5000 over 3 years (non-leap years)
      const inputs: XIRRInput[] = [
        createXIRRInput('2023-01-01', -10000),
        createXIRRInput('2024-01-01', 3000),
        createXIRRInput('2025-01-01', 4000),
        createXIRRInput('2026-01-01', 5000),
      ];
      
      const result = calculateXIRR(inputs, { tolerance: new Decimal('1e-8') });
      
      expect(result.converged).toBe(true);
      // Expected IRR ~ 8.96%
      expect(result.rate.toDecimalPlaces(4).toNumber()).toBeCloseTo(0.0896, 2);
    });
    
    it('should handle monthly cash flows', () => {
      const inputs: XIRRInput[] = [
        createXIRRInput('2023-01-01', -100000),
        createXIRRInput('2023-02-01', 5000),
        createXIRRInput('2023-03-01', 5000),
        createXIRRInput('2023-04-01', 5000),
        createXIRRInput('2023-05-01', 5000),
        createXIRRInput('2023-06-01', 5000),
        createXIRRInput('2023-07-01', 5000),
        createXIRRInput('2023-08-01', 5000),
        createXIRRInput('2023-09-01', 5000),
        createXIRRInput('2023-10-01', 5000),
        createXIRRInput('2023-11-01', 5000),
        createXIRRInput('2023-12-01', 5000),
        createXIRRInput('2024-01-01', 50000),
      ];
      
      const result = calculateXIRR(inputs, { tolerance: new Decimal('1e-6') });
      
      expect(result.converged).toBe(true);
      // Should be around 10-15% annualized
      expect(result.rate.toNumber()).toBeGreaterThan(0.05);
      expect(result.rate.toNumber()).toBeLessThan(0.50);
    });
    
    it('should fail with only positive cash flows', () => {
      const inputs: XIRRInput[] = [
        createXIRRInput('2023-01-01', 10000),
        createXIRRInput('2024-01-01', 11000),
      ];
      
      const result = calculateXIRR(inputs);
      
      expect(result.converged).toBe(false);
      expect(result.error).toContain('positive and negative');
    });
    
    it('should fail with only negative cash flows', () => {
      const inputs: XIRRInput[] = [
        createXIRRInput('2023-01-01', -10000),
        createXIRRInput('2024-01-01', -11000),
      ];
      
      const result = calculateXIRR(inputs);
      
      expect(result.converged).toBe(false);
      expect(result.error).toContain('positive and negative');
    });
    
    it('should fail with single cash flow', () => {
      const inputs: XIRRInput[] = [
        createXIRRInput('2023-01-01', -10000),
      ];
      
      const result = calculateXIRR(inputs);
      
      expect(result.converged).toBe(false);
      expect(result.error).toContain('At least two');
    });
    
    it('should use custom guess', () => {
      const inputs: XIRRInput[] = [
        createXIRRInput('2023-01-01', -100000),
        createXIRRInput('2024-01-01', 110000),
      ];
      
      const result = calculateXIRR(inputs, { guess: new Decimal(0.5) });
      
      expect(result.converged).toBe(true);
      expect(result.rate.toDecimalPlaces(4).toNumber()).toBeCloseTo(0.10, 3);
    });
  });
  
  describe('calculateXIRRFromCashFlows', () => {
    it('should work with CashFlow objects', () => {
      const flows: CashFlow[] = [
        createTestFlow('1', '2023-01-01', -100000),
        createTestFlow('2', '2024-01-01', 110000),
      ];
      
      const result = calculateXIRRFromCashFlows(flows);
      
      expect(result.converged).toBe(true);
      expect(result.rate.toDecimalPlaces(4).toNumber()).toBeCloseTo(0.10, 3);
    });
  });
  
  describe('calculateXNPVFromCashFlows', () => {
    it('should work with CashFlow objects', () => {
      const flows: CashFlow[] = [
        createTestFlow('1', '2023-01-01', -100000),
        createTestFlow('2', '2024-01-01', 110000),
      ];
      
      const result = calculateXNPVFromCashFlows(flows, new Decimal(0.10));
      
      // NPV should be close to 0 (exactly 0 for 365 days)
      expect(result.value.toDecimalPlaces(1).toNumber()).toBeCloseTo(0, 1);
      expect(result.rate.toNumber()).toBe(0.10);
    });
  });
  
  describe('validateXIRRInputs', () => {
    it('should validate correct inputs', () => {
      const inputs: XIRRInput[] = [
        createXIRRInput('2023-01-01', -10000),
        createXIRRInput('2024-01-01', 11000),
      ];
      
      const errors = validateXIRRInputs(inputs);
      expect(errors.length).toBe(0);
    });
    
    it('should reject non-increasing dates', () => {
      const inputs: XIRRInput[] = [
        createXIRRInput('2024-01-01', -10000),
        createXIRRInput('2023-01-01', 11000),
      ];
      
      const errors = validateXIRRInputs(inputs);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('strictly increasing');
    });
    
    it('should reject all positive', () => {
      const inputs: XIRRInput[] = [
        createXIRRInput('2023-01-01', 10000),
        createXIRRInput('2024-01-01', 11000),
      ];
      
      const errors = validateXIRRInputs(inputs);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});