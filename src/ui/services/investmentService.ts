import { Investment, CashFlow, Installment } from '../../domain/index.js';
import { Decimal } from 'decimal.js';

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

export function createMockInvestmentService(): InvestmentService {
  const investments = new Map<string, Investment>();

  function generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  function sortCashFlows(flows: CashFlow[]): CashFlow[] {
    return [...flows].sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  return {
    async createInvestment(investmentData) {
      const id = investmentData.id || generateId('inv');
      const investment: Investment = {
        id,
        name: investmentData.name,
        assetClass: investmentData.assetClass,
        currency: investmentData.currency,
        cashFlows: sortCashFlows(investmentData.cashFlows || []),
        installments: investmentData.installments,
        purchaseDate: investmentData.purchaseDate,
        valuationDate: investmentData.valuationDate,
        metadata: investmentData.metadata,
      };
      investments.set(id, investment);
      return investment;
    },

    async getInvestment(id: string) {
      return investments.get(id) || null;
    },

    async getAllInvestments() {
      return Array.from(investments.values());
    },

    async updateInvestment(investment) {
      investments.set(investment.id, investment);
      return investment;
    },

    async deleteInvestment(id: string) {
      return investments.delete(id);
    },

    async addCashFlow(investmentId: string, cashFlowData: CashFlowInput) {
      const investment = investments.get(investmentId);
      if (!investment) throw new Error(`Investment ${investmentId} not found`);

      const id = cashFlowData.id || generateId('cf');
      let cashFlow: CashFlow | Installment;
      
      if (cashFlowData.installmentNumber !== undefined) {
        cashFlow = {
          id,
          date: cashFlowData.date,
          amount: cashFlowData.amount,
          currency: cashFlowData.currency,
          description: cashFlowData.description,
          installmentNumber: cashFlowData.installmentNumber,
          totalInstallments: cashFlowData.totalInstallments || 1,
          dueDate: cashFlowData.dueDate || cashFlowData.date,
          paidDate: cashFlowData.paidDate,
          isPaid: cashFlowData.isPaid ?? true,
        } as Installment;
      } else {
        cashFlow = {
          id,
          date: cashFlowData.date,
          amount: cashFlowData.amount,
          currency: cashFlowData.currency,
          description: cashFlowData.description,
        };
      }

      const updatedFlows = sortCashFlows([...investment.cashFlows, cashFlow]);
      const updatedInvestment = { ...investment, cashFlows: updatedFlows };
      investments.set(investmentId, updatedInvestment);
      return cashFlow;
    },

    async updateCashFlow(investmentId: string, cashFlow: CashFlow) {
      const investment = investments.get(investmentId);
      if (!investment) throw new Error(`Investment ${investmentId} not found`);

      const updatedFlows = sortCashFlows(
        investment.cashFlows.map(f => f.id === cashFlow.id ? cashFlow : f)
      );
      const updatedInvestment = { ...investment, cashFlows: updatedFlows };
      investments.set(investmentId, updatedInvestment);
      return cashFlow;
    },

    async deleteCashFlow(investmentId: string, cashFlowId: string) {
      const investment = investments.get(investmentId);
      if (!investment) throw new Error(`Investment ${investmentId} not found`);

      const updatedFlows = investment.cashFlows.filter(f => f.id !== cashFlowId);
      const updatedInvestment = { ...investment, cashFlows: updatedFlows };
      investments.set(investmentId, updatedInvestment);
      return true;
    },

    async getCashFlows(investmentId: string) {
      const investment = investments.get(investmentId);
      return investment?.cashFlows || [];
    },

    close() {
      // No-op for mock
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