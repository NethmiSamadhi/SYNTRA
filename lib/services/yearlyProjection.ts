// lib/services/yearlyProjection.ts
import { getAccounts } from './accounts';
import { getTransactions } from './transactions';

export interface YearlyProjection {
  currentNetWorth: number;
  avgMonthlyIncome: number;
  avgMonthlyExpenses: number;
  avgMonthlySavings: number;
  projectedNetWorthNextYear: number;
  netWorthGrowthPct: number | null;
  savingsRatePct: number;
  trendLabel: 'Strong Growth' | 'Steady Growth' | 'Flat' | 'Declining';
  trendScore: number; // 0-100, a simplified trend indicator, not the official Financial Health Score
}

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

export async function getYearlyProjection(): Promise<YearlyProjection> {
  const [accounts, transactions] = await Promise.all([
    getAccounts(),
    getTransactions({ limit: 1000 }),
  ]);

  const currentNetWorth = accounts.reduce((sum: number, a: any) => sum + (a.balance || 0), 0);

  const cutoff = monthsAgo(3);
  const recentTxns = transactions.filter((t: any) => new Date(t.date) >= cutoff);

  const totalIncome = recentTxns.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + t.amount, 0);
  const totalExpenses = recentTxns.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + t.amount, 0);

  const avgMonthlyIncome = totalIncome / 3;
  const avgMonthlyExpenses = totalExpenses / 3;
  const avgMonthlySavings = avgMonthlyIncome - avgMonthlyExpenses;

  const projectedNetWorthNextYear = currentNetWorth + avgMonthlySavings * 12;
  const netWorthGrowthPct =
    currentNetWorth > 0 ? Math.round(((projectedNetWorthNextYear - currentNetWorth) / currentNetWorth) * 100) : null;

  const savingsRatePct = avgMonthlyIncome > 0 ? Math.round((avgMonthlySavings / avgMonthlyIncome) * 100) : 0;

  let trendLabel: YearlyProjection['trendLabel'] = 'Flat';
  let trendScore = 50;

  if (savingsRatePct >= 25) {
    trendLabel = 'Strong Growth';
    trendScore = Math.min(100, 70 + savingsRatePct / 2);
  } else if (savingsRatePct >= 10) {
    trendLabel = 'Steady Growth';
    trendScore = 55 + savingsRatePct;
  } else if (savingsRatePct >= 0) {
    trendLabel = 'Flat';
    trendScore = 45 + savingsRatePct;
  } else {
    trendLabel = 'Declining';
    trendScore = Math.max(0, 40 + savingsRatePct);
  }

  return {
    currentNetWorth,
    avgMonthlyIncome,
    avgMonthlyExpenses,
    avgMonthlySavings,
    projectedNetWorthNextYear,
    netWorthGrowthPct,
    savingsRatePct,
    trendLabel,
    trendScore: Math.round(trendScore),
  };
}