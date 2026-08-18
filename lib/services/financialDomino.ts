// lib/services/financialDomino.ts
import { getAccounts } from './accounts';
import { getCurrentMonthlyPlan } from './monthlyPlans';
import { getEMILoans } from './emiLoans';
import { getTransactions } from './transactions';
import { totalMonthlyEMIObligation } from '@/lib/utils/loanCalculations';
import { computeFinancialHealthScore, FHSInputs } from '@/lib/utils/financialHealthScore';
import { calculateAllDreamProgress } from './dreamProgress';

const TEST_USER_ID = 'test-user-1'; // matches the id used across dream-planning screens

export interface DominoStep {
  id: string;
  label: string;
  detail: string;
}

export interface DreamImpact {
  dreamId: string;
  title: string;
  monthsRemainingBefore: number | null;
  monthsRemainingAfter: number | null;
  delayMonths: number | null;
}

export interface DominoResult {
  purchaseAmount: number;
  delayMonths: number;
  healthScoreBefore: number;
  healthScoreAfter: number;
  healthScoreDelta: number;
  emergencyFundBefore: number;
  emergencyFundAfter: number;
  projectedYearEndSavingsBefore: number;
  projectedYearEndSavingsAfter: number;
  dreamImpacts: DreamImpact[];
  steps: DominoStep[];
}

async function buildFHSInputs(cashReduction: number) {
  const [plan, transactions, emiLoans, accountsRaw] = await Promise.all([
    getCurrentMonthlyPlan(),
    getTransactions({}),
    getEMILoans(),
    getAccounts(),
  ]);

  const totalMonthlyDebtPayments = totalMonthlyEMIObligation(emiLoans);

  const now = new Date();
  const monthlyExpenses = transactions
    .filter((t) => {
      const d = new Date(t.date);
      return t.type === 'expense' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyIncome = plan?.salary ?? 0;
  const monthlyEssentialExpenses = plan
    ? Object.values(plan.essentials).reduce((a: number, b: any) => a + (Number(b) || 0), 0)
    : monthlyExpenses;
  const allocationsTotal = plan
    ? Object.values(plan.allocations).reduce((a: number, b: any) => a + (Number(b) || 0), 0)
    : 0;
  const budgetedAmount = plan ? allocationsTotal + monthlyEssentialExpenses : monthlyExpenses;

  const accountList = accountsRaw.map((a: any) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    balance: a.balance,
  }));
  const savingsAccount = accountList.find((a) => a.type?.toLowerCase().includes('saving'));
  const emergencyFundBalance = Math.max((savingsAccount?.balance ?? 0) - cashReduction, 0);
  const monthlySavings = Math.max(monthlyIncome - monthlyExpenses, 0);

  const inputs: FHSInputs = {
    monthlyIncome,
    monthlyExpenses,
    monthlySavings,
    totalMonthlyDebtPayments,
    budgetedAmount,
    actualSpend: monthlyExpenses,
    emergencyFundBalance,
    monthlyEssentialExpenses,
  };

  return { inputs, monthlySavings, emergencyFundBalance };
}

/**
 * Simulates the ripple effect of a hypothetical purchase across financial
 * health, emergency buffer, active goals, and year-end projected savings.
 * delayMonths lets you model "buy it later" — the purchase amount is
 * softened by however much you'd save in the meantime.
 */
export async function simulatePurchaseImpact(purchaseAmount: number, delayMonths = 0): Promise<DominoResult> {
  const baseline = await buildFHSInputs(0);
  const baselineScore = computeFinancialHealthScore(baseline.inputs);

  const cushionFromWaiting = baseline.monthlySavings * delayMonths;
  const effectiveReduction = Math.max(purchaseAmount - cushionFromWaiting, 0);

  const afterPurchase = await buildFHSInputs(effectiveReduction);
  const afterScore = computeFinancialHealthScore(afterPurchase.inputs);

  const monthlyCapacityBefore = baseline.monthlySavings;
  const monthsToAbsorb = Math.max(12 - delayMonths, 1);
  const monthlyCapacityAfter = Math.max(baseline.monthlySavings - effectiveReduction / monthsToAbsorb, 0);

  const [progressBefore, progressAfter] = await Promise.all([
    calculateAllDreamProgress(TEST_USER_ID, monthlyCapacityBefore),
    calculateAllDreamProgress(TEST_USER_ID, monthlyCapacityAfter),
  ]);

  const dreamImpacts: DreamImpact[] = progressBefore.map((before) => {
    const after = progressAfter.find((p) => p.dream.id === before.dream.id);
    const delay =
      before.monthsRemaining != null && after?.monthsRemaining != null
        ? after.monthsRemaining - before.monthsRemaining
        : null;
    return {
      dreamId: before.dream.id,
      title: before.dream.title,
      monthsRemainingBefore: before.monthsRemaining,
      monthsRemainingAfter: after?.monthsRemaining ?? null,
      delayMonths: delay,
    };
  });

  const now = new Date();
  const monthsLeftInYear = Math.max(12 - now.getMonth(), 1);
  const projectedYearEndSavingsBefore = baseline.monthlySavings * monthsLeftInYear;
  const projectedYearEndSavingsAfter =
    afterPurchase.monthlySavings * monthsLeftInYear - effectiveReduction;

  const scoreDelta = afterScore.score - baselineScore.score;

  const steps: DominoStep[] = [
    {
      id: 'purchase',
      label: `Purchase — ${purchaseAmount}`,
      detail: delayMonths > 0 ? `Buying in ${delayMonths} month(s)` : 'Buying now',
    },
    {
      id: 'emergency',
      label: 'Emergency buffer',
      detail: `${Math.round(baseline.emergencyFundBalance)} \u2192 ${Math.round(afterPurchase.emergencyFundBalance)}`,
    },
    {
      id: 'health',
      label: 'Financial Health',
      detail: `${baselineScore.score} \u2192 ${afterScore.score} (${scoreDelta >= 0 ? '+' : ''}${scoreDelta} pts)`,
    },
  ];

  dreamImpacts
    .filter((d) => d.delayMonths && d.delayMonths > 0)
    .forEach((d) => {
      steps.push({
        id: `dream-${d.dreamId}`,
        label: `${d.title} delayed`,
        detail: `${d.delayMonths} month(s) later than planned`,
      });
    });

  steps.push({
    id: 'year-end',
    label: 'Projected year-end savings',
    detail: `${Math.round(projectedYearEndSavingsBefore)} \u2192 ${Math.round(projectedYearEndSavingsAfter)}`,
  });

  return {
    purchaseAmount,
    delayMonths,
    healthScoreBefore: baselineScore.score,
    healthScoreAfter: afterScore.score,
    healthScoreDelta: scoreDelta,
    emergencyFundBefore: baseline.emergencyFundBalance,
    emergencyFundAfter: afterPurchase.emergencyFundBalance,
    projectedYearEndSavingsBefore,
    projectedYearEndSavingsAfter,
    dreamImpacts,
    steps,
  };
}