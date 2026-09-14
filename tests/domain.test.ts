import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { 
  createGoldPrice,
  validateGoldPrice,
  getSpread,
  getSpreadPercentage,
  convertGoldUnit,
  GoldPrice
} from '../src/domain/gold.js';
import { 
  createFXRate,
  validateFXRate,
  invertRate,
  convertCurrency,
  FXRate
} from '../src/domain/fx.js';
import { 
  createCPIRecord,
  validateCPIRecord,
  calculateInflationFactor,
  adjustForInflation,
  CPIRecord
} from '../src/domain/cpi.js';
import { 
  createCashFlow,
  createInstallment,
  sumCashFlows,
  filterByDateRange,
  sortByDate,
  validateCashFlow,
  CashFlow
} from '../src/domain/cashflow.js';
import { 
  createInvestment,
  getTotalInvested,
  validateInvestment,
  Investment
} from '../src/domain/investment.js';
import { 
  createGoldPurchaseTrace,
  createCurrencyPurchaseTrace,
  createInflationAdjustmentTrace,
  calculateAbsoluteGainLoss,
  calculatePercentageReturn,
  AlternativeInvestmentResult
} from '../src/domain/results.js';
import { normalizeDate, isValidDate, daysBetween, yearsBetween } from '../src/domain/common.js';

// Helper to create UTC dates
const utcDate = (dateStr: string) => new Date(dateStr + 'T00:00:00.000Z');

describe('Domain Models', () => {
  describe('Common utilities', () => {
    describe('normalizeDate', () => {
      it('should normalize to midnight UTC', () => {
        const date = new Date('2024-09-15T14:30:00.000Z');
        const normalized = normalizeDate(date);
        
        expect(normalized.getUTCHours()).toBe(0);
        expect(normalized.getUTCMinutes()).toBe(0);
        expect(normalized.getUTCSeconds()).toBe(0);
        expect(normalized.getUTCMilliseconds()).toBe(0);
      });
    });
    
    describe('isValidDate', () => {
      it('should return true for valid dates', () => {
        expect(isValidDate(new Date())).toBe(true);
        expect(isValidDate(utcDate('2024-01-01'))).toBe(true);
      });
      
      it('should return false for invalid dates', () => {
        expect(isValidDate(new Date('invalid'))).toBe(false);
        expect(isValidDate(null)).toBe(false);
        expect(isValidDate('2024-01-01')).toBe(false);
      });
    });
    
    describe('daysBetween', () => {
      it('should calculate days correctly', () => {
        expect(daysBetween(utcDate('2024-01-01'), utcDate('2024-01-02'))).toBe(1);
        expect(daysBetween(utcDate('2024-01-01'), utcDate('2024-01-01'))).toBe(0);
        expect(daysBetween(utcDate('2024-01-10'), utcDate('2024-01-01'))).toBe(-9);
      });
    });
    
    describe('yearsBetween', () => {
      it('should calculate years as decimal', () => {
        const years = yearsBetween(utcDate('2024-01-01'), utcDate('2025-01-01'));
        expect(years.toDecimalPlaces(2).toNumber()).toBe(1.0);
        
        const halfYear = yearsBetween(utcDate('2024-01-01'), utcDate('2024-07-01'));
        expect(halfYear.toDecimalPlaces(2).toNumber()).toBeCloseTo(0.5, 1);
      });
    });
  });
  
  describe('Gold Price', () => {
    it('should create valid gold price', () => {
      const price = createGoldPrice(
        utcDate('2024-09-01'),
        new Decimal(5000),
        new Decimal(5100)
      );
      
      expect(price.bid.toNumber()).toBe(5000);
      expect(price.ask.toNumber()).toBe(5100);
      expect(price.unit).toBe('gram');
    });
    
    it('should validate correct price', () => {
      const price = createGoldPrice(
        utcDate('2024-09-01'),
        new Decimal(5000),
        new Decimal(5100)
      );
      
      const errors = validateGoldPrice(price);
      expect(errors.length).toBe(0);
    });
    
    it('should reject bid > ask', () => {
      const price: GoldPrice = {
        date: utcDate('2024-09-01'),
        bid: new Decimal(5100),
        ask: new Decimal(5000),
        currency: 'EGP',
        unit: 'gram',
      };
      
      const errors = validateGoldPrice(price);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Bid price cannot exceed Ask');
    });
    
    it('should reject zero or negative prices', () => {
      const price: GoldPrice = {
        date: utcDate('2024-09-01'),
        bid: new Decimal(0),
        ask: new Decimal(5100),
        currency: 'EGP',
        unit: 'gram',
      };
      
      const errors = validateGoldPrice(price);
      expect(errors.length).toBeGreaterThan(0);
    });
    
    it('should calculate spread', () => {
      const price = createGoldPrice(
        utcDate('2024-09-01'),
        new Decimal(5000),
        new Decimal(5100)
      );
      
      expect(getSpread(price).toNumber()).toBe(100);
      expect(getSpreadPercentage(price).toDecimalPlaces(2).toNumber()).toBe(2.0);
    });
    
    it('should convert units', () => {
      const price = createGoldPrice(
        utcDate('2024-09-01'),
        new Decimal(5000),
        new Decimal(5100),
        'gram'
      );
      
      const perOunce = convertGoldUnit(price, 'ounce');
      expect(perOunce.unit).toBe('ounce');
      expect(perOunce.bid.toDecimalPlaces(2).toNumber()).toBe(155517.5);
    });
  });
  
  describe('FX Rate', () => {
    it('should create valid FX rate', () => {
      const rate = createFXRate(
        utcDate('2024-09-01'),
        'EGP',
        'USD',
        new Decimal(49),
        new Decimal(50)
      );
      
      expect(rate.baseCurrency).toBe('EGP');
      expect(rate.quoteCurrency).toBe('USD');
    });
    
    it('should validate correct rate', () => {
      const rate = createFXRate(
        utcDate('2024-09-01'),
        'EGP',
        'USD',
        new Decimal(49),
        new Decimal(50)
      );
      
      const errors = validateFXRate(rate);
      expect(errors.length).toBe(0);
    });
    
    it('should reject bid > ask', () => {
      const rate: FXRate = {
        date: utcDate('2024-09-01'),
        baseCurrency: 'EGP',
        quoteCurrency: 'USD',
        bid: new Decimal(50),
        ask: new Decimal(49),
      };
      
      const errors = validateFXRate(rate);
      expect(errors.length).toBeGreaterThan(0);
    });
    
    it('should reject same base and quote', () => {
      const rate: FXRate = {
        date: utcDate('2024-09-01'),
        baseCurrency: 'EGP',
        quoteCurrency: 'EGP',
        bid: new Decimal(1),
        ask: new Decimal(1),
      };
      
      const errors = validateFXRate(rate);
      expect(errors.length).toBeGreaterThan(0);
    });
    
    it('should invert rate correctly', () => {
      const rate = createFXRate(
        utcDate('2024-09-01'),
        'EGP',
        'USD',
        new Decimal(49),
        new Decimal(50)
      );
      
      const inverted = invertRate(rate);
      
      expect(inverted.baseCurrency).toBe('USD');
      expect(inverted.quoteCurrency).toBe('EGP');
      expect(inverted.bid.toDecimalPlaces(6).toNumber()).toBe(0.02); // 1/50
      expect(inverted.ask.toDecimalPlaces(6).toNumber()).toBeCloseTo(0.020408, 4); // 1/49
    });
    
    it('should convert currency correctly', () => {
      const rate = createFXRate(
        utcDate('2024-09-01'),
        'EGP',
        'USD',
        new Decimal(49),
        new Decimal(50)
      );
      
      // EGP to USD using ask (buy USD)
      const usd = convertCurrency(new Decimal(100000), rate, 'base-to-quote', 'ask');
      expect(usd.toNumber()).toBe(2000);
      
      // USD to EGP using bid (sell USD)
      const egp = convertCurrency(new Decimal(2000), rate, 'quote-to-base', 'bid');
      expect(egp.toNumber()).toBe(98000);
    });
  });
  
  describe('CPI Record', () => {
    it('should create valid CPI record', () => {
      const record = createCPIRecord(
        utcDate('2024-09-01'),
        new Decimal(100)
      );
      
      expect(record.index.toNumber()).toBe(100);
      expect(record.baseYear).toBe(2010);
      expect(record.country).toBe('Egypt');
    });
    
    it('should validate correct record', () => {
      const record = createCPIRecord(
        utcDate('2024-09-01'),
        new Decimal(100)
      );
      
      const errors = validateCPIRecord(record);
      expect(errors.length).toBe(0);
    });
    
    it('should reject zero or negative index', () => {
      const record: CPIRecord = {
        date: utcDate('2024-09-01'),
        index: new Decimal(0),
        baseYear: 2010,
        country: 'Egypt',
      };
      
      const errors = validateCPIRecord(record);
      expect(errors.length).toBeGreaterThan(0);
    });
    
    it('should calculate inflation factor', () => {
      const factor = calculateInflationFactor(new Decimal(100), new Decimal(120));
      expect(factor.toNumber()).toBe(1.2);
    });
    
    it('should adjust for inflation', () => {
      const adjusted = adjustForInflation(new Decimal(100000), new Decimal(100), new Decimal(120));
      expect(adjusted.toNumber()).toBe(120000);
    });
  });
  
  describe('Cash Flow', () => {
    it('should create cash flow', () => {
      const flow = createCashFlow('1', utcDate('2024-09-01'), new Decimal(100000), 'EGP');
      
      expect(flow.id).toBe('1');
      expect(flow.amount.toNumber()).toBe(100000);
      expect(flow.currency).toBe('EGP');
    });
    
    it('should create installment', () => {
      const installment = createInstallment(
        '1', utcDate('2024-09-01'), new Decimal(10000), 'EGP',
        1, 12, utcDate('2024-09-01')
      );
      
      expect(installment.installmentNumber).toBe(1);
      expect(installment.totalInstallments).toBe(12);
      expect(installment.isPaid).toBe(true);
    });
    
    it('should sum cash flows', () => {
      const flows: CashFlow[] = [
        createCashFlow('1', utcDate('2024-09-01'), new Decimal(100000), 'EGP'),
        createCashFlow('2', utcDate('2024-10-01'), new Decimal(50000), 'EGP'),
      ];
      
      const sum = sumCashFlows(flows);
      expect(sum.toNumber()).toBe(150000);
    });
    
    it('should filter by date range', () => {
      const flows: CashFlow[] = [
        createCashFlow('1', utcDate('2024-08-01'), new Decimal(100000), 'EGP'),
        createCashFlow('2', utcDate('2024-09-01'), new Decimal(50000), 'EGP'),
        createCashFlow('3', utcDate('2024-10-01'), new Decimal(25000), 'EGP'),
      ];
      
      const filtered = filterByDateRange(flows, utcDate('2024-09-01'), utcDate('2024-09-30'));
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('2');
    });
    
    it('should sort by date', () => {
      const flows: CashFlow[] = [
        createCashFlow('1', utcDate('2024-10-01'), new Decimal(100000), 'EGP'),
        createCashFlow('2', utcDate('2024-08-01'), new Decimal(50000), 'EGP'),
      ];
      
      const sorted = sortByDate(flows);
      expect(sorted[0].id).toBe('2');
      expect(sorted[1].id).toBe('1');
    });
    
    it('should validate cash flow', () => {
      const flow = createCashFlow('1', utcDate('2024-09-01'), new Decimal(100000), 'EGP');
      const errors = validateCashFlow(flow);
      expect(errors.length).toBe(0);
    });
    
    it('should reject invalid cash flow', () => {
      const flow: CashFlow = {
        id: '',
        date: new Date('invalid'),
        amount: new Decimal(-100),
        currency: 'XYZ',
      };
      
      const errors = validateCashFlow(flow);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
  
  describe('Investment', () => {
    it('should create investment', () => {
      const flows: CashFlow[] = [
        createCashFlow('1', utcDate('2024-09-01'), new Decimal(100000), 'EGP'),
      ];
      
      const investment = createInvestment(
        'inv1', 'Test Property', 'real-estate', 'EGP',
        flows, utcDate('2024-12-01')
      );
      
      expect(investment.id).toBe('inv1');
      expect(investment.name).toBe('Test Property');
      expect(investment.assetClass).toBe('real-estate');
    });
    
    it('should calculate total invested', () => {
      const flows: CashFlow[] = [
        createCashFlow('1', utcDate('2024-09-01'), new Decimal(100000), 'EGP'),
        createCashFlow('2', utcDate('2024-10-01'), new Decimal(50000), 'EGP'),
      ];
      
      const investment = createInvestment(
        'inv1', 'Test', 'real-estate', 'EGP', flows, utcDate('2024-12-01')
      );
      
      expect(getTotalInvested(investment).toNumber()).toBe(150000);
    });
    
    it('should validate investment', () => {
      const flows: CashFlow[] = [
        createCashFlow('1', utcDate('2024-09-01'), new Decimal(100000), 'EGP'),
      ];
      
      const investment = createInvestment(
        'inv1', 'Test', 'real-estate', 'EGP', flows, utcDate('2024-12-01')
      );
      
      const errors = validateInvestment(investment);
      expect(errors.length).toBe(0);
    });
    
    it('should reject investment without cash flows', () => {
      const investment = createInvestment(
        'inv1', 'Test', 'real-estate', 'EGP', [], utcDate('2024-12-01')
      );
      
      const errors = validateInvestment(investment);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
  
  describe('Results', () => {
    it('should create gold purchase trace', () => {
      const trace = createGoldPurchaseTrace(
        '1', utcDate('2024-09-01'), new Decimal(100000),
        new Decimal(5100), utcDate('2024-09-01'), new Decimal(19.6078),
        utcDate('2024-12-01'), new Decimal(6000), utcDate('2024-12-01'),
        new Decimal(117647), 'exact'
      );
      
      expect(trace.paymentId).toBe('1');
      expect(trace.goldQuantity.toNumber()).toBe(19.6078);
    });
    
    it('should calculate absolute gain/loss', () => {
      const gain = calculateAbsoluteGainLoss(new Decimal(120000), new Decimal(100000));
      expect(gain.toNumber()).toBe(20000);
      
      const loss = calculateAbsoluteGainLoss(new Decimal(80000), new Decimal(100000));
      expect(loss.toNumber()).toBe(-20000);
    });
    
    it('should calculate percentage return', () => {
      const ret = calculatePercentageReturn(new Decimal(120000), new Decimal(100000));
      expect(ret.toNumber()).toBe(20);
      
      const zeroRet = calculatePercentageReturn(new Decimal(100000), new Decimal(0));
      expect(zeroRet.toNumber()).toBe(0);
    });
  });
});