import { Investment, CashFlow, GoldPrice, GoldPriceRecord, FXRate, FXRateRecord, CPIRecord, CPIRecordStored, Currency } from '../domain/index.js';
export interface DatabaseConfig {
    path: string;
    readonly?: boolean;
}
export declare class DataRepository {
    private db;
    constructor(config: DatabaseConfig);
    private initializeSchema;
    private generateId;
    private decimalToString;
    private stringToDecimal;
    saveInvestment(investment: Investment): Investment;
    getInvestment(id: string): Investment | null;
    getAllInvestments(): Investment[];
    deleteInvestment(id: string): boolean;
    saveCashFlows(investmentId: string, flows: CashFlow[]): void;
    getCashFlows(investmentId: string): CashFlow[];
    saveGoldPrice(price: GoldPrice): GoldPriceRecord;
    saveGoldPrices(prices: GoldPrice[]): void;
    getGoldPrices(startDate?: Date, endDate?: Date): GoldPriceRecord[];
    getGoldPrice(date: Date): GoldPriceRecord | null;
    saveFXRate(rate: FXRate): FXRateRecord;
    saveFXRates(rates: FXRate[]): void;
    getFXRates(baseCurrency: Currency, quoteCurrency: Currency, startDate?: Date, endDate?: Date): FXRateRecord[];
    saveCPIRecord(record: CPIRecord): CPIRecordStored;
    saveCPIRecords(records: CPIRecord[]): void;
    getCPIRecords(startDate?: Date, endDate?: Date): CPIRecordStored[];
    close(): void;
}
export declare function createRepository(config: DatabaseConfig): DataRepository;
//# sourceMappingURL=repository.d.ts.map