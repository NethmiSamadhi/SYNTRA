// lib/services/futureSelf.ts
import { getYearlyProjection } from './yearlyProjection';
import { getAccounts } from './accounts';
import { getEMILoans } from './emiLoans';
import { getTransactions } from './transactions';
import { getCurrentMonthlyPlan } from './monthlyPlans';
import { calculateAllDreamProgress } from './dreamProgress';
import { totalMonthlyEMIObligation } from '@/lib/utils/loanCalculations';
import { computeFinancialHealthScore, FHSInputs } from '@/lib/utils/financialHealthScore';
import { Transaction } from '@/lib/types';

const TEST_USER_ID = 'test-user-1'; // matches the id used across dream-planning screens
const HORIZON_MONTHS = 12;
const CATEGORY_REDUCTION_THRESHOLD_PCT = 10;

export interface FutureSelfCause {
  id: string;
  description: string;
}

export interface FutureSelfProfile {
  horizonLabel: string; // e.g. "August 2027"
  projectedSavings: number;
  projectedDebtRemaining: number;
  emergencyFundMonths: number;
  projectedHealthScore: number;
  goalsCompletedByThen: string[];
  causes: FutureSelfCause[];
  computedAt: string;
}

function monthLabel(monthsAhead: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function detectCauses(
  transactions: Transaction[],
  avgMonthlySavings: number,
  monthlyDebtPayment: number
): FutureSelfCause[] {
  const causes: FutureSelfCause[] = [];
  const now = new Date();
  const recentStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const priorStart = new Date(now.getFullYear(), now.getMonth() - 6, 1);

  const recent = transactions.filter((t) => {
    const d = new Date(t.date);
    return t.type === 'expense' && d >= recentStart && d < now;
  });
  const prior = transactions.filter((t) => {
    const d = new Date(t.date);
    return t.type === 'expense' && d >= priorStart && d < recentStart;
  });

  if (recent.length > 0 && prior.length > 0) {
    const recentByCategory = new Map<string, number>();
    const priorByCategory = new Map<string, number>();
    recent.forEach((t) => recentByCategory.set(t.category, (recentByCategory.get(t.category) ?? 0) + t.amount));
    prior.forEach((t) => priorByCategory.set(t.category, (priorByCategory.get(t.category) ?? 0) + t.amount));

    let biggestReduction: { category: string; pct: number } | null = null;
    priorByCategory.forEach((priorAmt, category) => {
      const recentAmt = recentByCategory.get(category) ?? 0;
      if (priorAmt > 0 && recentAmt < priorAmt) {
        const pct = ((priorAmt - recentAmt) / priorAmt) * 100;
        if (!biggestReduction || pct > biggestReduction.pct) {
          biggestReduction = { category, pct };
        }
      }
    });

    if (biggestReduction && biggestReduction.pct >= CATEGORY_REDUCTION_THRESHOLD_PCT) {
      causes.push({
        id: 'category-reduction',
        description: `You reduced ${biggestReduction.category} spending by ${Math.round(biggestReduction.pct)}%.`,
      });
    }
  }

  if (avgMonthlySavings > 0) {
    causes.push({
      id: 'savings-pace',
      description: `You're saving an average of ${Math.round(avgMonthlySavings)} per month.`,
    });
  }

  if (monthlyDebtPayment > 0) {
    causes.push({
      id: 'debt-payment',
      description: `You're putting ${Math.round(monthlyDebtPayment)} per month toward loan repayment.`,
    });
  }

  return causes;
}

/**
 * Projects the user's financial picture N months out — savings, debt,
 * emergency fund runway, and health score — and explains what real,
 * observed behavior is driving that projection.
 */
export async function getFutureSelfProfile(monthsAhead = HORIZON_MONTHS): Promise<FutureSelfProfile> {
  const [projection, accountsRaw, emiLoans, transactions, plan] = await Promise.all([
    getYearlyProjection(),
    getAccounts(),
    getEMILoans(),
    getTransactions({}),
    getCurrentMonthlyPlan(),
  ]);

  const projectedSavings = projection.currentNetWorth + projection.avgMonthlySavings * monthsAhead;

  const monthlyDebtPayment = totalMonthlyEMIObligation(emiLoans);
  const totalRemainingDebt = emiLoans.reduce((sum: number, l: any) => sum + (l.remaining || 0), 0);
  const projectedDebtRemaining = Math.max(totalRemainingDebt - monthlyDebtPayment * monthsAhead, 0);

  const now = new Date();
  const monthlyExpenses = transactions
    .filter((t) => {
      const d = new Date(t.date);
      return t.type === 'expense' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, t) => sum + t.amount, 0);

  const accountList = accountsRaw.map((a: any) => ({ type: a.type, balance: a.balance }));
  const savingsAccount = accountList.find((a) => a.type?.toLowerCase().includes('saving'));
  const projectedEmergencyBalance = (savingsAccount?.balance ?? 0) + projection.avgMonthlySavings * monthsAhead;
  const emergencyFundMonths = monthlyExpenses > 0 ? projectedEmergencyBalance / monthlyExpenses : 0;

  const monthlyEssentialExpenses = plan
    ? Object.values(plan.essentials).reduce((a: number, b: any) => a + (Number(b) || 0), 0)
    : monthlyExpenses;
  const allocationsTotal = plan
    ? Object.values(plan.allocations).reduce((a: number, b: any) => a + (Number(b) || 0), 0)
    : 0;

  const fhsInputs: FHSInputs = {
    monthlyIncome: plan?.salary ?? 0,
    monthlyExpenses,
    monthlySavings: Math.max(projection.avgMonthlySavings, 0),
    totalMonthlyDebtPayments: monthlyDebtPayment,
    budgetedAmount: allocationsTotal + monthlyEssentialExpenses,
    actualSpend: monthlyExpenses,
    emergencyFundBalance: projectedEmergencyBalance,
    monthlyEssentialExpenses,
  };
  const projectedHealth = computeFinancialHealthScore(fhsInputs);

  const dreamProgress = await calculateAllDreamProgress(TEST_USER_ID, projection.avgMonthlySavings);
  const goalsCompletedByThen = dreamProgress
    .filter((p) => p.monthsRemaining != null && p.monthsRemaining <= monthsAhead)
    .map((p) => p.dream.title);

  const causes = detectCauses(transactions, projection.avgMonthlySavings, monthlyDebtPayment);

  return {
    horizonLabel: monthLabel(monthsAhead),
    projectedSavings,
    projectedDebtRemaining,
    emergencyFundMonths,
    projectedHealthScore: projectedHealth.score,
    goalsCompletedByThen,
    causes,
    computedAt: new Date().toISOString(),
  };
}