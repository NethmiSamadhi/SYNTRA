// lib/services/wealthGoalProgress.ts
import { DreamPlan } from '@/lib/types';
import { getTotalSaved, getContributions } from './dreamPlans';

export interface WealthGoalProgress {
  dream: DreamPlan;
  currentNetWorth: number;
  targetNetWorth: number;
  progressPct: number;
  avgMonthlyContribution: number;
  assumedAnnualReturnRate: number; // conservative default, never auto-optimistic
  yearsRemaining: number | null;
  projectedCompletionDate: string | null;
  isRealistic: boolean; // flags implausible short timelines instead of hiding them
  milestone: 0 | 25 | 50 | 75 | 100;
}

// Conservative default — long-term diversified market return assumption,
// intentionally NOT tuned to make any target look achievable
const DEFAULT_ANNUAL_RETURN_RATE = 0.07;

function trailingMonthlyPace(contributions: { amount: number; contributedAt: string }[], months = 6) {
  if (contributions.length === 0) return 0;
  const cutoff = Date.now() - months * 30.44 * 24 * 60 * 60 * 1000;
  const recent = contributions.filter((c) => new Date(c.contributedAt).getTime() >= cutoff);
  if (recent.length === 0) return 0;
  return recent.reduce((sum, c) => sum + c.amount, 0) / months;
}

// Solves for years needed to go from currentPrincipal to targetAmount,
// given monthly contributions compounding at annualReturnRate.
// Uses the future value of an annuity + lump sum formula, solved numerically
// (closed-form log solution doesn't work cleanly once you add recurring contributions).
function yearsToTarget(
  currentPrincipal: number,
  targetAmount: number,
  monthlyContribution: number,
  annualReturnRate: number
): number | null {
  if (currentPrincipal >= targetAmount) return 0;
  if (monthlyContribution <= 0 && annualReturnRate <= 0) return null; // will never get there

  const monthlyRate = annualReturnRate / 12;
  let balance = currentPrincipal;
  let months = 0;
  const MAX_MONTHS = 12 * 100; // hard cap at 100 years — avoids infinite loops on tiny inputs

  while (balance < targetAmount && months < MAX_MONTHS) {
    balance = balance * (1 + monthlyRate) + monthlyContribution;
    months++;
  }

  return months >= MAX_MONTHS ? null : months / 12;
}

export async function calculateWealthGoalProgress(
  dream: DreamPlan,
  currentNetWorth: number, // pulled from user's broader financial data, not just this dream's ledger
  annualReturnRate: number = DEFAULT_ANNUAL_RETURN_RATE
): Promise<WealthGoalProgress> {
  const contributions = await getContributions(dream.id);
  const avgMonthlyContribution = trailingMonthlyPace(contributions);

  const targetNetWorth = dream.targetCost; // reuse targetCost field as target net worth
  const progressPct = targetNetWorth > 0
    ? Math.min(100, Math.round((currentNetWorth / targetNetWorth) * 100))
    : 0;

  const years = yearsToTarget(currentNetWorth, targetNetWorth, avgMonthlyContribution, annualReturnRate);

  let projectedCompletionDate: string | null = null;
  if (years !== null) {
    const d = new Date();
    d.setMonth(d.getMonth() + Math.round(years * 12));
    projectedCompletionDate = d.toISOString();
  }

  // If a user's target implies they need a return rate or savings pace far beyond
  // realistic bounds to hit their own stated deadline, flag it rather than
  // silently showing a falsely encouraging date
  const impliesUnrealisticDeadline =
    dream.targetDate != null &&
    years != null &&
    years > (new Date(dream.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 365) * 1.15;

  const milestone: WealthGoalProgress['milestone'] =
    progressPct >= 100 ? 100 : progressPct >= 75 ? 75 : progressPct >= 50 ? 50 : progressPct >= 25 ? 25 : 0;

  return {
    dream,
    currentNetWorth,
    targetNetWorth,
    progressPct,
    avgMonthlyContribution,
    assumedAnnualReturnRate: annualReturnRate,
    yearsRemaining: years,
    projectedCompletionDate,
    isRealistic: !impliesUnrealisticDeadline,
    milestone,
  };
}