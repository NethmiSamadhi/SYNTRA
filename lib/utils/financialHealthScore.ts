// lib/utils/financialHealthScore.ts
import { FinancialHealthScore } from '@/lib/types';

export interface FHSInputs {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySavings: number;
  totalMonthlyDebtPayments: number;
  budgetedAmount: number;
  actualSpend: number;
  emergencyFundBalance: number;
  monthlyEssentialExpenses: number;
}

function scoreSavingsRate(income: number, savings: number): number {
  if (income <= 0) return 0;
  const rate = savings / income;
  if (rate >= 0.2) return 30;
  if (rate <= 0) return 0;
  return Math.round((rate / 0.2) * 30);
}

function scoreDebtToIncome(income: number, debtPayments: number): number {
  if (income <= 0) return 0;
  const dti = debtPayments / income;
  if (dti <= 0.1) return 25;
  if (dti >= 0.5) return 0;
  return Math.round(25 * (1 - (dti - 0.1) / 0.4));
}

function scoreBudgetAdherence(budgeted: number, actual: number): number {
  if (budgeted <= 0) return 0;
  const overspendRatio = (actual - budgeted) / budgeted;
  if (overspendRatio <= 0) return 25;
  if (overspendRatio >= 0.3) return 0;
  return Math.round(25 * (1 - overspendRatio / 0.3));
}

function scoreEmergencyFund(essentialExpenses: number, fundBalance: number): number {
  if (essentialExpenses <= 0) return 0;
  const monthsCovered = fundBalance / essentialExpenses;
  if (monthsCovered >= 6) return 20;
  if (monthsCovered <= 0) return 0;
  return Math.round((monthsCovered / 6) * 20);
}

function labelForScore(score: number): FinancialHealthScore['label'] {
  if (score >= 85) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

export function computeFinancialHealthScore(
  input: FHSInputs
): Omit<FinancialHealthScore, 'id'> {
  const savingsRateScore = scoreSavingsRate(input.monthlyIncome, input.monthlySavings);
  const debtToIncomeScore = scoreDebtToIncome(input.monthlyIncome, input.totalMonthlyDebtPayments);
  const budgetAdherenceScore = scoreBudgetAdherence(input.budgetedAmount, input.actualSpend);
  const emergencyFundScore = scoreEmergencyFund(input.monthlyEssentialExpenses, input.emergencyFundBalance);
  const score = savingsRateScore + debtToIncomeScore + budgetAdherenceScore + emergencyFundScore;

  return {
    score,
    savingsRateScore,
    debtToIncomeScore,
    budgetAdherenceScore,
    emergencyFundScore,
    label: labelForScore(score),
    computedAt: new Date().toISOString(),
  };
}
