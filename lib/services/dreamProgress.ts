// lib/services/dreamProgress.ts
import { DreamPlan, DreamContribution } from '@/lib/types';
import { getActiveDreamPlans, getContributions, getTotalSaved } from './dreamPlans';

export interface DreamProgress {
  dream: DreamPlan;
  projectedTargetCost: number;   // targetCost adjusted for growth since createdAt
  totalSaved: number;
  amountRemaining: number;
  progressPct: number;           // 0-100
  avgMonthlyContribution: number; // trailing 3-month pace, from real ledger data
  allocatedMonthlyCapacity: number; // this dream's share of user's total capacity
  monthsRemaining: number | null; // null = can't project (no contributions/capacity yet)
  projectedCompletionDate: string | null;
  milestone: 0 | 25 | 50 | 75 | 100;
  readyToSimulate: boolean;
}

// Adjusts targetCost forward using the dream's own growth rate, based on elapsed time
function growAdjustedCost(dream: DreamPlan): number {
  const monthsElapsed =
    (Date.now() - new Date(dream.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  const yearsElapsed = monthsElapsed / 12;
  return dream.targetCost * Math.pow(1 + (dream.annualCostGrowthRate ?? 0), yearsElapsed);
}

// Trailing-window average, not a single blended average — reflects *recent* pace,
// so a slow start doesn't permanently drag down the projection (and vice versa)
function trailingMonthlyPace(contributions: DreamContribution[], months = 3): number {
  if (contributions.length === 0) return 0;
  const cutoff = Date.now() - months * 30.44 * 24 * 60 * 60 * 1000;
  const recent = contributions.filter((c) => new Date(c.contributedAt).getTime() >= cutoff);
  if (recent.length === 0) return 0;
  const total = recent.reduce((sum, c) => sum + c.amount, 0);
  return total / months;
}

// Splits a user's total monthly savings capacity across their active dreams,
// weighted by priorityWeight, so multiple goals don't each assume 100% of capacity
function allocateCapacity(dreams: DreamPlan[], totalCapacity: number): Map<string, number> {
  const totalWeight = dreams.reduce((sum, d) => sum + (d.priorityWeight ?? 3), 0);
  const map = new Map<string, number>();
  if (totalWeight === 0) {
    dreams.forEach((d) => map.set(d.id, 0));
    return map;
  }
  dreams.forEach((d) => {
    map.set(d.id, totalCapacity * ((d.priorityWeight ?? 3) / totalWeight));
  });
  return map;
}

export async function calculateDreamProgress(
  dream: DreamPlan,
  allocatedMonthlyCapacity: number
): Promise<DreamProgress> {
  const [totalSaved, contributions] = await Promise.all([
    getTotalSaved(dream.id),
    getContributions(dream.id),
  ]);

  const projectedTargetCost = growAdjustedCost(dream);
  const targetAmount =
    dream.category === 'car' || dream.category === 'home'
      ? projectedTargetCost * (dream.targetDownPaymentPct ?? 0.2)
      : projectedTargetCost;

  const amountRemaining = Math.max(targetAmount - totalSaved, 0);
  const progressPct = targetAmount > 0
    ? Math.min(100, Math.round((totalSaved / targetAmount) * 100))
    : 0;

  const avgMonthlyContribution = trailingMonthlyPace(contributions);
  // Blend real recent pace with allocated capacity — favor actual behavior over
  // stated intent once there's enough history to trust it
  const effectivePace =
    contributions.length >= 3 ? avgMonthlyContribution : allocatedMonthlyCapacity;

  let monthsRemaining: number | null = null;
  let projectedCompletionDate: string | null = null;
  if (effectivePace > 0 && amountRemaining > 0) {
    monthsRemaining = Math.ceil(amountRemaining / effectivePace);
    const d = new Date();
    d.setMonth(d.getMonth() + monthsRemaining);
    projectedCompletionDate = d.toISOString();
  } else if (amountRemaining <= 0) {
    monthsRemaining = 0;
    projectedCompletionDate = new Date().toISOString();
  }

  const milestone: DreamProgress['milestone'] =
    progressPct >= 100 ? 100 : progressPct >= 75 ? 75 : progressPct >= 50 ? 50 : progressPct >= 25 ? 25 : 0;

  return {
    dream,
    projectedTargetCost,
    totalSaved,
    amountRemaining,
    progressPct,
    avgMonthlyContribution,
    allocatedMonthlyCapacity,
    monthsRemaining,
    projectedCompletionDate,
    milestone,
    readyToSimulate: progressPct >= 100 && !dream.linkedSimulationId,
  };
}

// Computes progress for every active dream at once, with capacity properly split
export async function calculateAllDreamProgress(
  userId: string,
  totalMonthlySavingsCapacity: number
): Promise<DreamProgress[]> {
  const dreams = await getActiveDreamPlans(userId);
  const allocation = allocateCapacity(dreams, totalMonthlySavingsCapacity);

  return Promise.all(
    dreams.map((d) => calculateDreamProgress(d, allocation.get(d.id) ?? 0))
  );
}

// Detects milestone crossings between two progress snapshots — use this to decide
// whether to fire a "shooting star" animation / notification
export function crossedMilestone(previous: DreamProgress, current: DreamProgress): boolean {
  return current.milestone > previous.milestone;
}