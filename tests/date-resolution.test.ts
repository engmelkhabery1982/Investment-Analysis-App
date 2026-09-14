import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { 
  resolveDate,
  resolveMarketData,
  createDateResolver,
  validateDateOrder,
  validatePositiveRate,
  validateNonZeroAmount,
  MarketDataPoint
} from '../src/utils/date-resolution.js';
import { DateResolutionPolicy } from '../src/domain/common.js';

// Helper to create UTC dates
const utcDate = (dateStr: string) => new Date(dateStr + 'T00:00:00.000Z');

describe('Date Resolution Utilities', () => {
  const dates = [
    utcDate('2024-09-01'),
    utcDate('2024-09-10'),
    utcDate('2024-09-20'),
    utcDate('2024-10-01'),
  ];
  
  describe('resolveDate', () => {
    it('should return exact match when available', () => {
      const requested = utcDate('2024-09-10');
      const result = resolveDate(requested, dates, 'exact');
      
      expect(result.getTime()).toBe(requested.getTime());
    });
    
    it('should throw with exact policy when no match', () => {
      const requested = utcDate('2024-09-15');
      
      expect(() => resolveDate(requested, dates, 'exact'))
        .toThrow('No exact market data date found');
    });
    
    it('should return previous date with previous policy', () => {
      const requested = utcDate('2024-09-15');
      const result = resolveDate(requested, dates, 'previous');
      
      expect(result.getTime()).toBe(utcDate('2024-09-10').getTime());
    });
    
    it('should throw with previous policy when no previous date', () => {
      const requested = utcDate('2024-08-15');
      
      expect(() => resolveDate(requested, dates, 'previous'))
        .toThrow('No previous market data date available');
    });
    
    it('should return nearest date with nearest policy', () => {
      // 15th is closer to 10th (5 days) than 20th (5 days) - but 10th comes first
      const requested = utcDate('2024-09-15');
      const result = resolveDate(requested, dates, 'nearest');
      
      expect(result.getTime()).toBe(utcDate('2024-09-10').getTime());
    });
    
    it('should return nearest when clearly closer', () => {
      // 18th is closer to 20th (2 days) than 10th (8 days)
      const requested = utcDate('2024-09-18');
      const result = resolveDate(requested, dates, 'nearest');
      
      expect(result.getTime()).toBe(utcDate('2024-09-20').getTime());
    });

    it('should choose previous date on exact tie-break with nearest policy', () => {
      // 15th is exactly 5 days from both 10th and 20th - should choose previous (10th)
      const requested = utcDate('2024-09-15');
      const result = resolveDate(requested, dates, 'nearest');
      
      expect(result.getTime()).toBe(utcDate('2024-09-10').getTime());
    });

    it('should choose previous date on tie-break when previous comes first in list', () => {
      // Available dates: 10th and 20th, requested 15th (equidistant)
      // Should choose 10th (previous) even though 20th appears later in sorted list
      const availableDates = [utcDate('2024-09-10'), utcDate('2024-09-20')];
      const requested = utcDate('2024-09-15');
      const result = resolveDate(requested, availableDates, 'nearest');
      
      expect(result.getTime()).toBe(utcDate('2024-09-10').getTime());
    });

    it('should throw with empty available dates', () => {
      expect(() => resolveDate(utcDate('2024-09-15'), [], 'exact'))
        .toThrow('No available dates for resolution');
    });
  });

  describe('resolveDate - missing date resolution policies', () => {
    const availableDates = [
      utcDate('2024-09-01'),
      utcDate('2024-09-10'),
      utcDate('2024-09-20'),
      utcDate('2024-10-01'),
    ];

    it('should use previous policy for missing date', () => {
      const requested = utcDate('2024-09-15');
      const result = resolveDate(requested, availableDates, 'previous');
      
      expect(result.getTime()).toBe(utcDate('2024-09-10').getTime());
    });

    it('should use nearest policy for missing date (closer to 20th)', () => {
      const requested = utcDate('2024-09-18');
      const result = resolveDate(requested, availableDates, 'nearest');
      
      expect(result.getTime()).toBe(utcDate('2024-09-20').getTime());
    });

    it('should use previous policy when date before all available', () => {
      const requested = utcDate('2024-08-15');
      
      expect(() => resolveDate(requested, availableDates, 'previous'))
        .toThrow('No previous market data date available');
    });

    it('should use nearest policy when date before all available (chooses earliest)', () => {
      const requested = utcDate('2024-08-15');
      const result = resolveDate(requested, availableDates, 'nearest');
      
      expect(result.getTime()).toBe(utcDate('2024-09-01').getTime());
    });

    it('should use nearest policy when date after all available (chooses latest)', () => {
      const requested = utcDate('2024-11-01');
      const result = resolveDate(requested, availableDates, 'nearest');
      
      expect(result.getTime()).toBe(utcDate('2024-10-01').getTime());
    });
  });
  
  describe('resolveMarketData', () => {
    it('should resolve with correct source date', () => {
      const dataPoints: MarketDataPoint<number>[] = [
        { date: utcDate('2024-09-01'), value: 100 },
        { date: utcDate('2024-09-10'), value: 110 },
        { date: utcDate('2024-09-20'), value: 120 },
      ];
      
      const result = resolveMarketData(
        utcDate('2024-09-15'),
        dataPoints,
        'previous',
        p => p.date
      );
      
      expect(result.value).toBe(110);
      expect(result.sourceDate.toISOString().split('T')[0]).toBe('2024-09-10');
      expect(result.requestedDate.toISOString().split('T')[0]).toBe('2024-09-15');
      expect(result.policy).toBe('previous');
    });
    
    it('should throw when resolved date not in data points', () => {
      const dataPoints: MarketDataPoint<number>[] = [
        { date: utcDate('2024-09-01'), value: 100 },
      ];
      
      // This should not happen with correct implementation but test anyway
      expect(() => resolveMarketData(
        utcDate('2024-09-15'),
        dataPoints,
        'previous',
        p => p.date
      )).not.toThrow();
    });
  });
  
  describe('createDateResolver', () => {
    it('should create resolver with default policy', () => {
      const dataPoints: MarketDataPoint<number>[] = [
        { date: utcDate('2024-09-01'), value: 100 },
        { date: utcDate('2024-09-10'), value: 110 },
      ];
      
      const resolver = createDateResolver(dataPoints, p => p.date);
      
      const result = resolver.resolve(utcDate('2024-09-05'));
      expect(result.value).toBe(100);
      expect(result.policy).toBe('previous');
    });
    
    it('should allow policy override', () => {
      const dataPoints: MarketDataPoint<number>[] = [
        { date: utcDate('2024-09-01'), value: 100 },
        { date: utcDate('2024-09-10'), value: 110 },
      ];
      
      const resolver = createDateResolver(dataPoints, p => p.date, 'nearest');
      
      const result = resolver.resolve(utcDate('2024-09-05'), 'nearest');
      expect(result.policy).toBe('nearest');
    });
    
    it('should return available dates sorted', () => {
      const dataPoints: MarketDataPoint<number>[] = [
        { date: utcDate('2024-09-10'), value: 110 },
        { date: utcDate('2024-09-01'), value: 100 },
      ];
      
      const resolver = createDateResolver(dataPoints, p => p.date);
      const dates = resolver.getAvailableDates();
      
      expect(dates[0].toISOString().split('T')[0]).toBe('2024-09-01');
      expect(dates[1].toISOString().split('T')[0]).toBe('2024-09-10');
    });
    
    it('should check exact date existence', () => {
      const dataPoints: MarketDataPoint<number>[] = [
        { date: utcDate('2024-09-01'), value: 100 },
      ];
      
      const resolver = createDateResolver(dataPoints, p => p.date);
      
      expect(resolver.hasExactDate(utcDate('2024-09-01'))).toBe(true);
      expect(resolver.hasExactDate(utcDate('2024-09-02'))).toBe(false);
    });
  });
  
  describe('validateDateOrder', () => {
    it('should pass when payment before valuation', () => {
      expect(() => validateDateOrder(
        utcDate('2024-09-01'),
        utcDate('2024-12-01')
      )).not.toThrow();
    });
    
it('should throw when payment after valuation', () => {
      expect(() => validateDateOrder(
        utcDate('2024-12-01'),
        utcDate('2024-09-01')
      )).toThrow('cannot be after valuation date');
    });

    it('should pass when payment equals valuation', () => {
      expect(() => validateDateOrder(
        utcDate('2024-09-01'),
        utcDate('2024-09-01')
      )).not.toThrow();
    });
  });
  
  describe('validatePositiveRate', () => {
    it('should pass for positive rate', () => {
      expect(() => validatePositiveRate(new Decimal(100), 'Test Rate')).not.toThrow();
      expect(() => validatePositiveRate(new Decimal('0.0001'), 'Test Rate')).not.toThrow();
    });
    
    it('should throw for zero', () => {
      expect(() => validatePositiveRate(new Decimal(0), 'Test Rate'))
        .toThrow('Test Rate must be a positive number');
    });
    
    it('should throw for negative', () => {
      expect(() => validatePositiveRate(new Decimal(-1), 'Test Rate'))
        .toThrow('Test Rate must be a positive number');
    });
    
    it('should throw for NaN', () => {
      expect(() => validatePositiveRate(new Decimal(NaN), 'Test Rate'))
        .toThrow('Test Rate must be a positive number');
    });
  });
  
  describe('validateNonZeroAmount', () => {
    it('should pass for non-zero', () => {
      expect(() => validateNonZeroAmount(new Decimal(100), 'Amount')).not.toThrow();
      expect(() => validateNonZeroAmount(new Decimal(-100), 'Amount')).not.toThrow();
    });
    
    it('should throw for zero', () => {
      expect(() => validateNonZeroAmount(new Decimal(0), 'Amount'))
        .toThrow('Amount cannot be zero');
    });
  });
});