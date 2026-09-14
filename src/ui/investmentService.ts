import { DataRepository, createRepository, DatabaseConfig } from '../data/repository.js';
import { Investment, CashFlow, Installment } from '../domain/index.js';
import { Decimal } from 'decimal.js';
import { createInvestment } from '../domain/investment.js';
import { createCashFlow, createInstallment } from '../domain/cashflow.js';
import { Currency, AssetClass } from '../domain/common.js';

interface CashFlowInput extends Omit<CashFlow, 'id'> {
  id?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  dueDate?: Date;
  paidDate?: Date;
  isPaid?: boolean;
}

export interface InvestmentService {
  createInvestment(investment: Omit<Investment, 'id'> & { id?: string }): Promise<Investment>;
  getInvestment(id: string): Promise<Investment | null>;
  getAllInvestments(): Promise<Investment[]>;
  updateInvestment(investment: Investment): Promise<Investment>;
  deleteInvestment(id: string): Promise<boolean>;
  addCashFlow(investmentId: string, cashFlow: CashFlowInput): Promise<CashFlow>;
  updateCashFlow(investmentId: string, cashFlow: CashFlow): Promise<CashFlow>;
  deleteCashFlow(investmentId: string, cashFlowId: string): Promise<boolean>;
  getCashFlows(investmentId: string): Promise<CashFlow[]>;
  close(): void;
}

export function createInvestmentService(config: DatabaseConfig): InvestmentService {
  const repo = createRepository(config);

  return {
    async createInvestment(investmentData) {
      const id = investmentData.id || `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const investment = createInvestment(
        id,
        investmentData.name,
        investmentData.assetClass,
        investmentData.currency,
        investmentData.cashFlows || [],
        investmentData.valuationDate,
        {
          installments: investmentData.installments,
          purchaseDate: investmentData.purchaseDate,
          metadata: investmentData.metadata,
        }
      );
      repo.saveInvestmentWithCashFlows(investment, investment.cashFlows);
      return investment;
    },

    async getInvestment(id: string) {
      return repo.getInvestmentWithCashFlows(id);
    },

    async getAllInvestments() {
      return repo.getAllInvestments().map(inv => repo.getInvestmentWithCashFlows(inv.id)!);
    },

    async updateInvestment(investment) {
      repo.saveInvestmentWithCashFlows(investment, investment.cashFlows);
      return investment;
    },

    async deleteInvestment(id: string) {
      return repo.deleteInvestment(id);
    },

    async addCashFlow(investmentId: string, cashFlowData: CashFlowInput) {
      const investment = repo.getInvestmentWithCashFlows(investmentId);
      if (!investment) throw new Error(`Investment ${investmentId} not found`);

      const id = cashFlowData.id || `cf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      let cashFlow: CashFlow | Installment;
      
      if (cashFlowData.installmentNumber !== undefined) {
        const installment = createInstallment(
          id,
          cashFlowData.date,
          cashFlowData.amount,
          cashFlowData.currency,
          cashFlowData.installmentNumber,
          cashFlowData.totalInstallments || 1,
          cashFlowData.dueDate || cashFlowData.date,
          cashFlowData.description
        );
        if (cashFlowData.paidDate !== undefined) {
          installment.paidDate = cashFlowData.paidDate;
        }
        installment.isPaid = cashFlowData.isPaid ?? true;
        cashFlow = installment;
      } else {
        cashFlow = createCashFlow(
          id,
          cashFlowData.date,
          cashFlowData.amount,
          cashFlowData.currency,
          cashFlowData.description
        );
      }

      const updatedFlows = [...investment.cashFlows, cashFlow].sort((a, b) => a.date.getTime() - b.date.getTime());
      repo.saveInvestmentWithCashFlows(investment, updatedFlows);
      return cashFlow;
    },

    async updateCashFlow(investmentId: string, cashFlow: CashFlow) {
      const investment = repo.getInvestmentWithCashFlows(investmentId);
      if (!investment) throw new Error(`Investment ${investmentId} not found`);

      const updatedFlows = investment.cashFlows.map(f => f.id === cashFlow.id ? cashFlow : f);
      repo.saveInvestmentWithCashFlows(investment, updatedFlows);
      return cashFlow;
    },

    async deleteCashFlow(investmentId: string, cashFlowId: string) {
      const investment = repo.getInvestmentWithCashFlows(investmentId);
      if (!investment) throw new Error(`Investment ${investmentId} not found`);

      const updatedFlows = investment.cashFlows.filter(f => f.id !== cashFlowId);
      repo.saveInvestmentWithCashFlows(investment, updatedFlows);
      return true;
    },

    async getCashFlows(investmentId: string) {
      return repo.getCashFlows(investmentId);
    },

    close() {
      repo.close();
    },
  };
}

export function formatDateForInput(date: Date): string {
  const iso = date.toISOString();
  const parts = iso.split('T');
  return parts[0] ?? '';
}

export function parseDateFromInput(dateStr: string): Date {
  const parts = dateStr.split('-');
  if (parts.length !== 3) throw new Error(`Invalid date format: ${dateStr}`);
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDecimalForInput(decimal: Decimal): string {
  return decimal.toString();
}

export function parseDecimalFromInput(str: string): Decimal {
  return new Decimal(str);
}