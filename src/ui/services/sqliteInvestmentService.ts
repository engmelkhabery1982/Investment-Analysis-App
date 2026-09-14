import { DataRepository, createRepository, DatabaseConfig } from '../../data/repository.js';
import { Investment, CashFlow, Installment } from '../../domain/index.js';
import { Decimal } from 'decimal.js';
import { createInvestment } from '../../domain/investment.js';
import { createCashFlow, createInstallment } from '../../domain/cashflow.js';
import { InvestmentService } from './investmentService.js';

interface CashFlowInput extends Omit<CashFlow, 'id'> {
  id?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  dueDate?: Date;
  paidDate?: Date;
  isPaid?: boolean;
}

export function createSqliteInvestmentService(config: DatabaseConfig): InvestmentService {
  const repo = createRepository(config);

  function generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  function sortCashFlows(flows: CashFlow[]): CashFlow[] {
    return [...flows].sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  return {
    async createInvestment(investmentData) {
      const id = investmentData.id || generateId('inv');
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

      const id = cashFlowData.id || generateId('cf');
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

      const updatedFlows = sortCashFlows([...investment.cashFlows, cashFlow]);
      repo.saveInvestmentWithCashFlows(investment, updatedFlows);
      return cashFlow;
    },

    async updateCashFlow(investmentId: string, cashFlow: CashFlow) {
      const investment = repo.getInvestmentWithCashFlows(investmentId);
      if (!investment) throw new Error(`Investment ${investmentId} not found`);

      const updatedFlows = sortCashFlows(
        investment.cashFlows.map(f => f.id === cashFlow.id ? cashFlow : f)
      );
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