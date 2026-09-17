import { useMemo } from 'react';
import { useSyncExternalStore } from 'react';
import { subscribe, getState } from './store';
import { analyze } from './finance';

export function useStore() {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function useInvestments() {
  const s = useStore();
  return s.investments;
}

export function useCashFlows(investmentId) {
  const s = useStore();
  return useMemo(() => s.cashflows.filter(c => c.investmentId === investmentId), [s.cashflows, investmentId]);
}

export function useSelectedInvestment() {
  const s = useStore();
  return useMemo(() => s.investments.find(i => i.id === s.settings.selectedInvestmentId) || null, [s.investments, s.settings.selectedInvestmentId]);
}

export function useAnalysis(investmentId) {
  const s = useStore();
  return useMemo(() => {
    const investment = s.investments.find(i => i.id === investmentId);
    if (!investment) return null;
    const cashFlows = s.cashflows.filter(c => c.investmentId === investmentId);
    return analyze({ investment, cashFlows, gold: s.gold, fx: s.fx, cpi: s.cpi, settings: s.settings });
  }, [s, investmentId]);
}