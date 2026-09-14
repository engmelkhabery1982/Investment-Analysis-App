import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Decimal } from 'decimal.js';
import { DataRepository, createRepository, DatabaseConfig } from '../src/data/repository.js';
import { createInvestment } from '../src/domain/investment.js';
import { createCashFlow } from '../src/domain/cashflow.js';
import { Currency, AssetClass } from '../src/domain/common.js';
import { existsSync, unlinkSync } from 'fs';

// Helper to create UTC dates
const utcDate = (dateStr: string) => new Date(dateStr + 'T00:00:00.000Z');

const TEST_DB_PATH = 'test-investment.db';

function createTestConfig(): DatabaseConfig {
  return { path: TEST_DB_PATH };
}

function cleanupTestDb() {
  if (existsSync(TEST_DB_PATH)) {
    unlinkSync(TEST_DB_PATH);
  }
  // Also clean up WAL and SHM files
  if (existsSync(TEST_DB_PATH + '-wal')) {
    unlinkSync(TEST_DB_PATH + '-wal');
  }
  if (existsSync(TEST_DB_PATH + '-shm')) {
    unlinkSync(TEST_DB_PATH + '-shm');
  }
}

describe('DataRepository - SQLite Persistence', () => {
  let repo: DataRepository;

  beforeEach(() => {
    cleanupTestDb();
    repo = createRepository(createTestConfig());
  });

  afterEach(() => {
    repo.close();
    cleanupTestDb();
  });

  const createTestFlow = (id: string, date: string, amount: number): CashFlow =>
    createCashFlow(id, utcDate(date), new Decimal(amount), 'EGP');

  const createTestInvestment = (id: string, name: string, flows: CashFlow[], valuationDate: Date): Investment =>
    createInvestment(id, name, 'real-estate', 'EGP', flows, valuationDate);

  describe('Investment CRUD', () => {
    it('should save and retrieve an investment', () => {
      const flows = [createTestFlow('1', '2024-09-01', 100000)];
      const investment = createTestInvestment('inv1', 'Test Property', flows, utcDate('2024-12-01'));
      
      repo.saveInvestment(investment);
      const retrieved = repo.getInvestment('inv1');
      
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe('inv1');
      expect(retrieved!.name).toBe('Test Property');
      expect(retrieved!.assetClass).toBe('real-estate');
      expect(retrieved!.currency).toBe('EGP');
      expect(retrieved!.valuationDate.toISOString().split('T')[0]).toBe('2024-12-01');
    });

    it('should save and retrieve investment with purchase date', () => {
      const flows = [createTestFlow('1', '2024-09-01', 100000)];
      const investment = createTestInvestment('inv1', 'Test Property', flows, utcDate('2024-12-01'));
      investment.purchaseDate = utcDate('2024-08-01');
      
      repo.saveInvestment(investment);
      const retrieved = repo.getInvestment('inv1');
      
      expect(retrieved!.purchaseDate).toBeDefined();
      expect(retrieved!.purchaseDate!.toISOString().split('T')[0]).toBe('2024-08-01');
    });

    it('should return null for non-existent investment', () => {
      const retrieved = repo.getInvestment('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should update existing investment', () => {
      const flows = [createTestFlow('1', '2024-09-01', 100000)];
      const investment = createTestInvestment('inv1', 'Original Name', flows, utcDate('2024-12-01'));
      repo.saveInvestment(investment);
      
      investment.name = 'Updated Name';
      repo.saveInvestment(investment);
      
      const retrieved = repo.getInvestment('inv1');
      expect(retrieved!.name).toBe('Updated Name');
    });

    it('should delete an investment', () => {
      const flows = [createTestFlow('1', '2024-09-01', 100000)];
      const investment = createTestInvestment('inv1', 'Test', flows, utcDate('2024-12-01'));
      repo.saveInvestment(investment);
      
      const deleted = repo.deleteInvestment('inv1');
      expect(deleted).toBe(true);
      
      const retrieved = repo.getInvestment('inv1');
      expect(retrieved).toBeNull();
    });

    it('should return false when deleting non-existent investment', () => {
      const deleted = repo.deleteInvestment('non-existent');
      expect(deleted).toBe(false);
    });

    it('should get all investments', () => {
      const flows1 = [createTestFlow('1', '2024-09-01', 100000)];
      const flows2 = [createTestFlow('2', '2024-10-01', 200000)];
      
      repo.saveInvestment(createTestInvestment('inv1', 'Property 1', flows1, utcDate('2024-12-01')));
      repo.saveInvestment(createTestInvestment('inv2', 'Property 2', flows2, utcDate('2024-12-01')));
      
      const all = repo.getAllInvestments();
      expect(all.length).toBe(2);
      expect(all.map(i => i.id).sort()).toEqual(['inv1', 'inv2']);
    });
  });

  describe('Investment with Cash Flows', () => {
    it('should save investment with cash flows in transaction', () => {
      const flows = [
        createTestFlow('cf1', '2024-09-01', 100000),
        createTestFlow('cf2', '2024-10-01', 50000),
      ];
      const investment = createTestInvestment('inv1', 'Test Property', flows, utcDate('2024-12-01'));
      
      repo.saveInvestmentWithCashFlows(investment, flows);
      
      const retrieved = repo.getInvestmentWithCashFlows('inv1');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.cashFlows.length).toBe(2);
      expect(retrieved!.cashFlows[0].id).toBe('cf1');
      expect(retrieved!.cashFlows[1].id).toBe('cf2');
    });

    it('should retrieve investment with cash flows loaded', () => {
      const flows = [
        createTestFlow('cf1', '2024-09-01', 100000),
        createTestFlow('cf2', '2024-10-01', 50000),
      ];
      const investment = createTestInvestment('inv1', 'Test Property', flows, utcDate('2024-12-01'));
      repo.saveInvestmentWithCashFlows(investment, flows);
      
      const retrieved = repo.getInvestmentWithCashFlows('inv1');
      expect(retrieved!.cashFlows.length).toBe(2);
      
      // Verify cash flow details
      const cf1 = retrieved!.cashFlows.find(f => f.id === 'cf1');
      expect(cf1).toBeDefined();
      expect(cf1!.amount.toNumber()).toBe(100000);
      expect(cf1!.date.toISOString().split('T')[0]).toBe('2024-09-01');
      expect(cf1!.currency).toBe('EGP');
    });

    it('should return null for non-existent investment with cash flows', () => {
      const retrieved = repo.getInvestmentWithCashFlows('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('Cash Flow CRUD', () => {
    it('should save and retrieve cash flows for an investment', () => {
      const flows = [
        createTestFlow('cf1', '2024-09-01', 100000),
        createTestFlow('cf2', '2024-10-01', 50000),
      ];
      const investment = createTestInvestment('inv1', 'Test', flows, utcDate('2024-12-01'));
      repo.saveInvestment(investment);
      
      repo.saveCashFlows('inv1', flows);
      const retrieved = repo.getCashFlows('inv1');
      
      expect(retrieved.length).toBe(2);
      expect(retrieved[0].id).toBe('cf1');
      expect(retrieved[1].id).toBe('cf2');
    });

    it('should preserve Decimal precision exactly', () => {
      const flows = [
        createCashFlow('cf1', utcDate('2024-09-01'), new Decimal('123456.7890123456789'), 'EGP'),
      ];
      const investment = createTestInvestment('inv1', 'Test', flows, utcDate('2024-12-01'));
      repo.saveInvestment(investment);
      repo.saveCashFlows('inv1', flows);
      
      const retrieved = repo.getCashFlows('inv1');
      expect(retrieved[0].amount.toString()).toBe('123456.7890123456789');
    });

    it('should preserve UTC dates exactly', () => {
      const flows = [createTestFlow('cf1', '2024-09-01', 100000)];
      const investment = createTestInvestment('inv1', 'Test', flows, utcDate('2024-12-01'));
      repo.saveInvestment(investment);
      repo.saveCashFlows('inv1', flows);
      
      const retrieved = repo.getCashFlows('inv1');
      expect(retrieved[0].date.toISOString().split('T')[0]).toBe('2024-09-01');
      // Verify it's UTC midnight
      expect(retrieved[0].date.getUTCHours()).toBe(0);
      expect(retrieved[0].date.getUTCMinutes()).toBe(0);
      expect(retrieved[0].date.getUTCSeconds()).toBe(0);
    });

    it('should replace existing cash flows when saving again', () => {
      const flows1 = [createTestFlow('cf1', '2024-09-01', 100000)];
      const flows2 = [createTestFlow('cf2', '2024-10-01', 200000)];
      const investment = createTestInvestment('inv1', 'Test', flows1, utcDate('2024-12-01'));
      repo.saveInvestment(investment);
      repo.saveCashFlows('inv1', flows1);
      
      repo.saveCashFlows('inv1', flows2);
      const retrieved = repo.getCashFlows('inv1');
      
      expect(retrieved.length).toBe(1);
      expect(retrieved[0].id).toBe('cf2');
      expect(retrieved[0].amount.toNumber()).toBe(200000);
    });

    it('should delete cash flows explicitly', () => {
      const flows = [createTestFlow('cf1', '2024-09-01', 100000)];
      const investment = createTestInvestment('inv1', 'Test', flows, utcDate('2024-12-01'));
      repo.saveInvestment(investment);
      repo.saveCashFlows('inv1', flows);
      
      const deletedCount = repo.deleteCashFlows('inv1');
      expect(deletedCount).toBe(1);
      
      const retrieved = repo.getCashFlows('inv1');
      expect(retrieved.length).toBe(0);
    });

    it('should return 0 when deleting cash flows for non-existent investment', () => {
      const deletedCount = repo.deleteCashFlows('non-existent');
      expect(deletedCount).toBe(0);
    });

    it('should handle installment fields', () => {
      const installment = createCashFlow(
        'inst1', utcDate('2024-09-01'), new Decimal(50000), 'EGP',
        'Installment 1'
      );
      installment.installmentNumber = 1;
      installment.totalInstallments = 12;
      installment.dueDate = utcDate('2024-09-01');
      installment.paidDate = utcDate('2024-09-01');
      installment.isPaid = true;
      
      const investment = createTestInvestment('inv1', 'Test', [installment], utcDate('2024-12-01'));
      repo.saveInvestment(investment);
      repo.saveCashFlows('inv1', [installment]);
      
      const retrieved = repo.getCashFlows('inv1');
      expect(retrieved[0].installmentNumber).toBe(1);
      expect(retrieved[0].totalInstallments).toBe(12);
      expect(retrieved[0].dueDate!.toISOString().split('T')[0]).toBe('2024-09-01');
      expect(retrieved[0].paidDate!.toISOString().split('T')[0]).toBe('2024-09-01');
      expect(retrieved[0].isPaid).toBe(true);
    });
  });

  describe('Cascade Delete Behavior', () => {
    it('should cascade delete cash flows when investment is deleted', () => {
      const flows = [
        createTestFlow('cf1', '2024-09-01', 100000),
        createTestFlow('cf2', '2024-10-01', 50000),
      ];
      const investment = createTestInvestment('inv1', 'Test', flows, utcDate('2024-12-01'));
      repo.saveInvestmentWithCashFlows(investment, flows);
      
      // Verify cash flows exist
      expect(repo.getCashFlows('inv1').length).toBe(2);
      
      // Delete investment
      repo.deleteInvestment('inv1');
      
      // Cash flows should be cascade deleted
      expect(repo.getCashFlows('inv1').length).toBe(0);
      expect(repo.getInvestment('inv1')).toBeNull();
    });

    it('should cascade delete cash flows when using saveInvestmentWithCashFlows', () => {
      const flows = [createTestFlow('cf1', '2024-09-01', 100000)];
      const investment = createTestInvestment('inv1', 'Test', flows, utcDate('2024-12-01'));
      repo.saveInvestmentWithCashFlows(investment, flows);
      
      repo.deleteInvestment('inv1');
      
      expect(repo.getCashFlows('inv1').length).toBe(0);
    });
  });

  describe('Market Data Operations', () => {
    it('should save and retrieve gold prices', () => {
      repo.saveGoldPrice({
        date: utcDate('2024-09-01'),
        bid: new Decimal('5000'),
        ask: new Decimal('5100'),
        currency: 'EGP',
        unit: 'gram',
        source: 'test'
      } as any);
      
      const prices = repo.getGoldPrices();
      expect(prices.length).toBe(1);
      expect(prices[0].bid.toString()).toBe('5000');
      expect(prices[0].ask.toString()).toBe('5100');
      expect(prices[0].date.toISOString().split('T')[0]).toBe('2024-09-01');
    });

    it('should save and retrieve FX rates', () => {
      repo.saveFXRate({
        date: utcDate('2024-09-01'),
        baseCurrency: 'EGP',
        quoteCurrency: 'USD',
        bid: new Decimal('49'),
        ask: new Decimal('50'),
        source: 'test'
      } as any);
      
      const rates = repo.getFXRates('EGP', 'USD');
      expect(rates.length).toBe(1);
      expect(rates[0].bid.toString()).toBe('49');
      expect(rates[0].ask.toString()).toBe('50');
    });

    it('should save and retrieve CPI records', () => {
      repo.saveCPIRecord({
        date: utcDate('2024-09-01'),
        index: new Decimal('100'),
        baseYear: 2010,
        country: 'Egypt',
        source: 'test'
      });
      
      const records = repo.getCPIRecords();
      expect(records.length).toBe(1);
      expect(records[0].index.toString()).toBe('100');
      expect(records[0].date.toISOString().split('T')[0]).toBe('2024-09-01');
    });
  });

  describe('Data Integrity', () => {
    it('should handle multiple investments with separate cash flows', () => {
      const flows1 = [createTestFlow('cf1', '2024-09-01', 100000)];
      const flows2 = [createTestFlow('cf2', '2024-10-01', 200000)];
      
      const inv1 = createTestInvestment('inv1', 'Property 1', flows1, utcDate('2024-12-01'));
      const inv2 = createTestInvestment('inv2', 'Property 2', flows2, utcDate('2024-12-01'));
      
      repo.saveInvestmentWithCashFlows(inv1, flows1);
      repo.saveInvestmentWithCashFlows(inv2, flows2);
      
      const retrieved1 = repo.getInvestmentWithCashFlows('inv1');
      const retrieved2 = repo.getInvestmentWithCashFlows('inv2');
      
      expect(retrieved1!.cashFlows.length).toBe(1);
      expect(retrieved1!.cashFlows[0].id).toBe('cf1');
      expect(retrieved2!.cashFlows.length).toBe(1);
      expect(retrieved2!.cashFlows[0].id).toBe('cf2');
    });

    it('should maintain referential integrity', () => {
      const flows = [createTestFlow('cf1', '2024-09-01', 100000)];
      const investment = createTestInvestment('inv1', 'Test', flows, utcDate('2024-12-01'));
      repo.saveInvestmentWithCashFlows(investment, flows);
      
      // Verify foreign key constraint works
      const cashFlows = repo.getCashFlows('inv1');
      expect(cashFlows.length).toBe(1);
      expect(cashFlows[0].amount.toNumber()).toBe(100000);
    });
  });
});

describe('Repository Factory', () => {
  it('should create repository instance', () => {
    const repo = createRepository({ path: ':memory:' });
    expect(repo).toBeInstanceOf(DataRepository);
    repo.close();
  });
});