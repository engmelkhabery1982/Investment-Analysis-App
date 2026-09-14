import Database from 'better-sqlite3';
import { Decimal } from 'decimal.js';
import { 
  Investment, CashFlow, Installment, GoldPrice, GoldPriceRecord, FXRate, FXRateRecord, CPIRecord, CPIRecordStored,
  Currency, AssetClass
} from '../domain/index.js';
import { normalizeDate } from '../domain/common.js';

export interface DatabaseConfig {
  path: string;
  readonly?: boolean;
}

export class DataRepository {
  private db: Database.Database;
  
  constructor(config: DatabaseConfig) {
    this.db = new Database(config.path, { readonly: config.readonly || false });
    this.initializeSchema();
  }
  
  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS investments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        asset_class TEXT NOT NULL,
        currency TEXT NOT NULL,
        purchase_date TEXT,
        valuation_date TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS cash_flows (
        id TEXT PRIMARY KEY,
        investment_id TEXT NOT NULL,
        date TEXT NOT NULL,
        amount TEXT NOT NULL,
        currency TEXT NOT NULL,
        description TEXT,
        metadata TEXT,
        installment_number INTEGER,
        total_installments INTEGER,
        due_date TEXT,
        paid_date TEXT,
        is_paid INTEGER DEFAULT 1,
        FOREIGN KEY (investment_id) REFERENCES investments(id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_cash_flows_investment ON cash_flows(investment_id);
      CREATE INDEX IF NOT EXISTS idx_cash_flows_date ON cash_flows(date);
      
      CREATE TABLE IF NOT EXISTS gold_prices (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL UNIQUE,
        bid TEXT NOT NULL,
        ask TEXT NOT NULL,
        unit TEXT NOT NULL DEFAULT 'gram',
        source TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_gold_prices_date ON gold_prices(date);
      
      CREATE TABLE IF NOT EXISTS fx_rates (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        base_currency TEXT NOT NULL,
        quote_currency TEXT NOT NULL,
        bid TEXT NOT NULL,
        ask TEXT NOT NULL,
        source TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date, base_currency, quote_currency)
      );
      
      CREATE INDEX IF NOT EXISTS idx_fx_rates_date ON fx_rates(date);
      CREATE INDEX IF NOT EXISTS idx_fx_rates_pair ON fx_rates(base_currency, quote_currency);
      
      CREATE TABLE IF NOT EXISTS cpi_records (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL UNIQUE,
        index_value TEXT NOT NULL,
        base_year INTEGER NOT NULL DEFAULT 2010,
        country TEXT NOT NULL DEFAULT 'Egypt',
        source TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_cpi_records_date ON cpi_records(date);
    `);
  }
  
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private decimalToString(d: Decimal): string {
    return d.toFixed(10);
  }
  
  private stringToDecimal(s: string): Decimal {
    return new Decimal(s);
  }
  
  // Investment operations
  saveInvestment(investment: Investment): Investment {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO investments 
      (id, name, asset_class, currency, purchase_date, valuation_date, metadata, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run(
      investment.id,
      investment.name,
      investment.assetClass,
      investment.currency,
      investment.purchaseDate?.toISOString().split('T')[0] || null,
      investment.valuationDate.toISOString().split('T')[0],
      JSON.stringify(investment.metadata || {})
    );
    
    return investment;
  }
  
  getInvestment(id: string): Investment | null {
    const stmt = this.db.prepare('SELECT * FROM investments WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      name: row.name,
      assetClass: row.asset_class as AssetClass,
      currency: row.currency as Currency,
      cashFlows: [],
      purchaseDate: row.purchase_date ? new Date(row.purchase_date) : undefined,
      valuationDate: new Date(row.valuation_date),
      metadata: JSON.parse(row.metadata || '{}'),
    };
  }
  
  getAllInvestments(): Investment[] {
    const stmt = this.db.prepare('SELECT * FROM investments ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      assetClass: row.asset_class as AssetClass,
      currency: row.currency as Currency,
      cashFlows: [],
      purchaseDate: row.purchase_date ? new Date(row.purchase_date) : undefined,
      valuationDate: new Date(row.valuation_date),
      metadata: JSON.parse(row.metadata || '{}'),
    }));
  }
  
  deleteInvestment(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM investments WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
  
  // Cash Flow operations
  saveCashFlows(investmentId: string, flows: CashFlow[]): void {
    const deleteStmt = this.db.prepare('DELETE FROM cash_flows WHERE investment_id = ?');
    deleteStmt.run(investmentId);
    
    const insertStmt = this.db.prepare(`
      INSERT INTO cash_flows 
      (id, investment_id, date, amount, currency, description, metadata, 
       installment_number, total_installments, due_date, paid_date, is_paid)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = this.db.transaction((flows: CashFlow[]) => {
      for (const flow of flows) {
        const installment = flow as Installment;
        insertStmt.run(
          flow.id,
          investmentId,
          normalizeDate(flow.date).toISOString().split('T')[0],
          this.decimalToString(flow.amount),
          flow.currency,
          flow.description || null,
          JSON.stringify(flow.metadata || {}),
          installment.installmentNumber || null,
          installment.totalInstallments || null,
          installment.dueDate ? normalizeDate(installment.dueDate).toISOString().split('T')[0] : null,
          installment.paidDate ? normalizeDate(installment.paidDate).toISOString().split('T')[0] : null,
          installment.isPaid ? 1 : 0
        );
      }
    });
    
    insertMany(flows);
  }
  
  getCashFlows(investmentId: string): CashFlow[] {
    const stmt = this.db.prepare('SELECT * FROM cash_flows WHERE investment_id = ? ORDER BY date');
    const rows = stmt.all(investmentId) as any[];
    
    return rows.map(row => ({
      id: row.id,
      date: new Date(row.date),
      amount: this.stringToDecimal(row.amount),
      currency: row.currency as Currency,
      description: row.description,
      metadata: JSON.parse(row.metadata || '{}'),
      installmentNumber: row.installment_number,
      totalInstallments: row.total_installments,
      dueDate: row.due_date ? new Date(row.due_date) : undefined,
      paidDate: row.paid_date ? new Date(row.paid_date) : undefined,
      isPaid: Boolean(row.is_paid),
    }));
  }
  
  // Gold Price operations
  saveGoldPrice(price: GoldPrice): GoldPriceRecord {
    const id = this.generateId();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO gold_prices (id, date, bid, ask, unit, source, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run(
      id,
      normalizeDate(price.date).toISOString().split('T')[0],
      this.decimalToString(price.bid),
      this.decimalToString(price.ask),
      price.unit,
      price.source || null
    );
    
    const now = new Date();
    return { ...price, id, createdAt: now, updatedAt: now };
  }
  
  saveGoldPrices(prices: GoldPrice[]): void {
    const insertMany = this.db.transaction((prices: GoldPrice[]) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO gold_prices (id, date, bid, ask, unit, source, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      for (const price of prices) {
        stmt.run(
          this.generateId(),
          normalizeDate(price.date).toISOString().split('T')[0],
          this.decimalToString(price.bid),
          this.decimalToString(price.ask),
          price.unit,
          price.source || null
        );
      }
    });
    
    insertMany(prices);
  }
  
  getGoldPrices(startDate?: Date, endDate?: Date): GoldPriceRecord[] {
    let query = 'SELECT * FROM gold_prices';
    const params: any[] = [];
    
    if (startDate || endDate) {
      query += ' WHERE';
      if (startDate) {
        query += ' date >= ?';
        params.push(normalizeDate(startDate).toISOString().split('T')[0]);
      }
      if (endDate) {
        if (startDate) query += ' AND';
        query += ' date <= ?';
        params.push(normalizeDate(endDate).toISOString().split('T')[0]);
      }
    }
    
    query += ' ORDER BY date';
    
    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    
    return rows.map(row => ({
      id: row.id,
      date: new Date(row.date),
      bid: this.stringToDecimal(row.bid),
      ask: this.stringToDecimal(row.ask),
      currency: 'EGP',
      unit: row.unit as 'gram' | 'ounce' | 'kilogram',
      source: row.source,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }
  
  getGoldPrice(date: Date): GoldPriceRecord | null {
    const stmt = this.db.prepare('SELECT * FROM gold_prices WHERE date = ?');
    const row = stmt.get(normalizeDate(date).toISOString().split('T')[0]) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      date: new Date(row.date),
      bid: this.stringToDecimal(row.bid),
      ask: this.stringToDecimal(row.ask),
      currency: 'EGP',
      unit: row.unit as 'gram' | 'ounce' | 'kilogram',
      source: row.source,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
  
  // FX Rate operations
  saveFXRate(rate: FXRate): FXRateRecord {
    const id = this.generateId();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO fx_rates (id, date, base_currency, quote_currency, bid, ask, source, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run(
      id,
      normalizeDate(rate.date).toISOString().split('T')[0],
      rate.baseCurrency,
      rate.quoteCurrency,
      this.decimalToString(rate.bid),
      this.decimalToString(rate.ask),
      rate.source || null
    );
    
    const now = new Date();
    return { ...rate, id, createdAt: now, updatedAt: now };
  }
  
  saveFXRates(rates: FXRate[]): void {
    const insertMany = this.db.transaction((rates: FXRate[]) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO fx_rates (id, date, base_currency, quote_currency, bid, ask, source, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      for (const rate of rates) {
        stmt.run(
          this.generateId(),
          normalizeDate(rate.date).toISOString().split('T')[0],
          rate.baseCurrency,
          rate.quoteCurrency,
          this.decimalToString(rate.bid),
          this.decimalToString(rate.ask),
          rate.source || null
        );
      }
    });
    
    insertMany(rates);
  }
  
  getFXRates(
    baseCurrency: Currency, 
    quoteCurrency: Currency, 
    startDate?: Date, 
    endDate?: Date
  ): FXRateRecord[] {
    let query = 'SELECT * FROM fx_rates WHERE base_currency = ? AND quote_currency = ?';
    const params: any[] = [baseCurrency, quoteCurrency];
    
    if (startDate || endDate) {
      if (startDate) {
        query += ' AND date >= ?';
        params.push(normalizeDate(startDate).toISOString().split('T')[0]);
      }
      if (endDate) {
        query += ' AND date <= ?';
        params.push(normalizeDate(endDate).toISOString().split('T')[0]);
      }
    }
    
    query += ' ORDER BY date';
    
    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    
    return rows.map(row => ({
      id: row.id,
      date: new Date(row.date),
      baseCurrency: row.base_currency as Currency,
      quoteCurrency: row.quote_currency as Currency,
      bid: this.stringToDecimal(row.bid),
      ask: this.stringToDecimal(row.ask),
      source: row.source,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }
  
  // CPI Record operations
  saveCPIRecord(record: CPIRecord): CPIRecordStored {
    const id = this.generateId();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cpi_records (id, date, index_value, base_year, country, source, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run(
      id,
      normalizeDate(record.date).toISOString().split('T')[0],
      this.decimalToString(record.index),
      record.baseYear,
      record.country,
      record.source || null
    );
    
    const now = new Date();
    return { ...record, id, createdAt: now, updatedAt: now };
  }
  
  saveCPIRecords(records: CPIRecord[]): void {
    const insertMany = this.db.transaction((records: CPIRecord[]) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO cpi_records (id, date, index_value, base_year, country, source, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      for (const record of records) {
        stmt.run(
          this.generateId(),
          normalizeDate(record.date).toISOString().split('T')[0],
          this.decimalToString(record.index),
          record.baseYear,
          record.country,
          record.source || null
        );
      }
    });
    
    insertMany(records);
  }
  
  getCPIRecords(startDate?: Date, endDate?: Date): CPIRecordStored[] {
    let query = 'SELECT * FROM cpi_records';
    const params: any[] = [];
    
    if (startDate || endDate) {
      query += ' WHERE';
      if (startDate) {
        query += ' date >= ?';
        params.push(normalizeDate(startDate).toISOString().split('T')[0]);
      }
      if (endDate) {
        if (startDate) query += ' AND';
        query += ' date <= ?';
        params.push(normalizeDate(endDate).toISOString().split('T')[0]);
      }
    }
    
    query += ' ORDER BY date';
    
    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    
    return rows.map(row => ({
      id: row.id,
      date: new Date(row.date),
      index: this.stringToDecimal(row.index_value),
      baseYear: row.base_year,
      country: row.country,
      source: row.source,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }
  
  close(): void {
    this.db.close();
  }
}

export function createRepository(config: DatabaseConfig): DataRepository {
  return new DataRepository(config);
}