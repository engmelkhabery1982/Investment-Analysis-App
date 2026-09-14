"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataRepository = void 0;
exports.createRepository = createRepository;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const decimal_js_1 = require("decimal.js");
const common_js_1 = require("../domain/common.js");
class DataRepository {
    db;
    constructor(config) {
        this.db = new better_sqlite3_1.default(config.path, { readonly: config.readonly || false });
        this.initializeSchema();
    }
    initializeSchema() {
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
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    decimalToString(d) {
        return d.toFixed(10);
    }
    stringToDecimal(s) {
        return new decimal_js_1.Decimal(s);
    }
    // Investment operations
    saveInvestment(investment) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO investments 
      (id, name, asset_class, currency, purchase_date, valuation_date, metadata, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
        stmt.run(investment.id, investment.name, investment.assetClass, investment.currency, investment.purchaseDate?.toISOString().split('T')[0] || null, investment.valuationDate.toISOString().split('T')[0], JSON.stringify(investment.metadata || {}));
        return investment;
    }
    getInvestment(id) {
        const stmt = this.db.prepare('SELECT * FROM investments WHERE id = ?');
        const row = stmt.get(id);
        if (!row)
            return null;
        return {
            id: row.id,
            name: row.name,
            assetClass: row.asset_class,
            currency: row.currency,
            cashFlows: [],
            purchaseDate: row.purchase_date ? new Date(row.purchase_date) : undefined,
            valuationDate: new Date(row.valuation_date),
            metadata: JSON.parse(row.metadata || '{}'),
        };
    }
    getAllInvestments() {
        const stmt = this.db.prepare('SELECT * FROM investments ORDER BY created_at DESC');
        const rows = stmt.all();
        return rows.map(row => ({
            id: row.id,
            name: row.name,
            assetClass: row.asset_class,
            currency: row.currency,
            cashFlows: [],
            purchaseDate: row.purchase_date ? new Date(row.purchase_date) : undefined,
            valuationDate: new Date(row.valuation_date),
            metadata: JSON.parse(row.metadata || '{}'),
        }));
    }
    deleteInvestment(id) {
        const stmt = this.db.prepare('DELETE FROM investments WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
    // Cash Flow operations
    saveCashFlows(investmentId, flows) {
        const deleteStmt = this.db.prepare('DELETE FROM cash_flows WHERE investment_id = ?');
        deleteStmt.run(investmentId);
        const insertStmt = this.db.prepare(`
      INSERT INTO cash_flows 
      (id, investment_id, date, amount, currency, description, metadata, 
       installment_number, total_installments, due_date, paid_date, is_paid)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const insertMany = this.db.transaction((flows) => {
            for (const flow of flows) {
                const installment = flow;
                insertStmt.run(flow.id, investmentId, (0, common_js_1.normalizeDate)(flow.date).toISOString().split('T')[0], this.decimalToString(flow.amount), flow.currency, flow.description || null, JSON.stringify(flow.metadata || {}), installment.installmentNumber || null, installment.totalInstallments || null, installment.dueDate ? (0, common_js_1.normalizeDate)(installment.dueDate).toISOString().split('T')[0] : null, installment.paidDate ? (0, common_js_1.normalizeDate)(installment.paidDate).toISOString().split('T')[0] : null, installment.isPaid ? 1 : 0);
            }
        });
        insertMany(flows);
    }
    getCashFlows(investmentId) {
        const stmt = this.db.prepare('SELECT * FROM cash_flows WHERE investment_id = ? ORDER BY date');
        const rows = stmt.all(investmentId);
        return rows.map(row => ({
            id: row.id,
            date: new Date(row.date),
            amount: this.stringToDecimal(row.amount),
            currency: row.currency,
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
    saveGoldPrice(price) {
        const id = this.generateId();
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO gold_prices (id, date, bid, ask, unit, source, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
        stmt.run(id, (0, common_js_1.normalizeDate)(price.date).toISOString().split('T')[0], this.decimalToString(price.bid), this.decimalToString(price.ask), price.unit, price.source || null);
        const now = new Date();
        return { ...price, id, createdAt: now, updatedAt: now };
    }
    saveGoldPrices(prices) {
        const insertMany = this.db.transaction((prices) => {
            const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO gold_prices (id, date, bid, ask, unit, source, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
            for (const price of prices) {
                stmt.run(this.generateId(), (0, common_js_1.normalizeDate)(price.date).toISOString().split('T')[0], this.decimalToString(price.bid), this.decimalToString(price.ask), price.unit, price.source || null);
            }
        });
        insertMany(prices);
    }
    getGoldPrices(startDate, endDate) {
        let query = 'SELECT * FROM gold_prices';
        const params = [];
        if (startDate || endDate) {
            query += ' WHERE';
            if (startDate) {
                query += ' date >= ?';
                params.push((0, common_js_1.normalizeDate)(startDate).toISOString().split('T')[0]);
            }
            if (endDate) {
                if (startDate)
                    query += ' AND';
                query += ' date <= ?';
                params.push((0, common_js_1.normalizeDate)(endDate).toISOString().split('T')[0]);
            }
        }
        query += ' ORDER BY date';
        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params);
        return rows.map(row => ({
            id: row.id,
            date: new Date(row.date),
            bid: this.stringToDecimal(row.bid),
            ask: this.stringToDecimal(row.ask),
            currency: 'EGP',
            unit: row.unit,
            source: row.source,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
        }));
    }
    getGoldPrice(date) {
        const stmt = this.db.prepare('SELECT * FROM gold_prices WHERE date = ?');
        const row = stmt.get((0, common_js_1.normalizeDate)(date).toISOString().split('T')[0]);
        if (!row)
            return null;
        return {
            id: row.id,
            date: new Date(row.date),
            bid: this.stringToDecimal(row.bid),
            ask: this.stringToDecimal(row.ask),
            currency: 'EGP',
            unit: row.unit,
            source: row.source,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
        };
    }
    // FX Rate operations
    saveFXRate(rate) {
        const id = this.generateId();
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO fx_rates (id, date, base_currency, quote_currency, bid, ask, source, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
        stmt.run(id, (0, common_js_1.normalizeDate)(rate.date).toISOString().split('T')[0], rate.baseCurrency, rate.quoteCurrency, this.decimalToString(rate.bid), this.decimalToString(rate.ask), rate.source || null);
        const now = new Date();
        return { ...rate, id, createdAt: now, updatedAt: now };
    }
    saveFXRates(rates) {
        const insertMany = this.db.transaction((rates) => {
            const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO fx_rates (id, date, base_currency, quote_currency, bid, ask, source, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
            for (const rate of rates) {
                stmt.run(this.generateId(), (0, common_js_1.normalizeDate)(rate.date).toISOString().split('T')[0], rate.baseCurrency, rate.quoteCurrency, this.decimalToString(rate.bid), this.decimalToString(rate.ask), rate.source || null);
            }
        });
        insertMany(rates);
    }
    getFXRates(baseCurrency, quoteCurrency, startDate, endDate) {
        let query = 'SELECT * FROM fx_rates WHERE base_currency = ? AND quote_currency = ?';
        const params = [baseCurrency, quoteCurrency];
        if (startDate || endDate) {
            if (startDate) {
                query += ' AND date >= ?';
                params.push((0, common_js_1.normalizeDate)(startDate).toISOString().split('T')[0]);
            }
            if (endDate) {
                query += ' AND date <= ?';
                params.push((0, common_js_1.normalizeDate)(endDate).toISOString().split('T')[0]);
            }
        }
        query += ' ORDER BY date';
        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params);
        return rows.map(row => ({
            id: row.id,
            date: new Date(row.date),
            baseCurrency: row.base_currency,
            quoteCurrency: row.quote_currency,
            bid: this.stringToDecimal(row.bid),
            ask: this.stringToDecimal(row.ask),
            source: row.source,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
        }));
    }
    // CPI Record operations
    saveCPIRecord(record) {
        const id = this.generateId();
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cpi_records (id, date, index_value, base_year, country, source, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
        stmt.run(id, (0, common_js_1.normalizeDate)(record.date).toISOString().split('T')[0], this.decimalToString(record.index), record.baseYear, record.country, record.source || null);
        const now = new Date();
        return { ...record, id, createdAt: now, updatedAt: now };
    }
    saveCPIRecords(records) {
        const insertMany = this.db.transaction((records) => {
            const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO cpi_records (id, date, index_value, base_year, country, source, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
            for (const record of records) {
                stmt.run(this.generateId(), (0, common_js_1.normalizeDate)(record.date).toISOString().split('T')[0], this.decimalToString(record.index), record.baseYear, record.country, record.source || null);
            }
        });
        insertMany(records);
    }
    getCPIRecords(startDate, endDate) {
        let query = 'SELECT * FROM cpi_records';
        const params = [];
        if (startDate || endDate) {
            query += ' WHERE';
            if (startDate) {
                query += ' date >= ?';
                params.push((0, common_js_1.normalizeDate)(startDate).toISOString().split('T')[0]);
            }
            if (endDate) {
                if (startDate)
                    query += ' AND';
                query += ' date <= ?';
                params.push((0, common_js_1.normalizeDate)(endDate).toISOString().split('T')[0]);
            }
        }
        query += ' ORDER BY date';
        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params);
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
    close() {
        this.db.close();
    }
}
exports.DataRepository = DataRepository;
function createRepository(config) {
    return new DataRepository(config);
}
//# sourceMappingURL=repository.js.map