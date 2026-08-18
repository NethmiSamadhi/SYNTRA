// lib/services/goalCollision.ts
import { DreamPlan } from '@/lib/types';
import { getActiveDreamPlans } from './dreamPlans';
import { calculateDreamProgress } from './dreamProgress';
import { getTransactions } from './transactions';

export interface GoalRequirement {
  dream: DreamPlan;
  amountRemaining: number;
  monthsRemaining: number;
  requiredMonthly: number;
}

export interface CollisionSuggestion {
  type: 'delay' | 'reduce' | 'increase_income';
  targetDream: DreamPlan;
  delayMonths?: number;
  newProjectedMonths?: number;
  reduceAmount?: number;
  newTargetCost?: number;
  extraMonthlyNeeded?: number;
  message: string;
}

export interface GoalCollisionResult {
  hasCollision: boolean;
  totalRequiredMonthly: number;
  totalRequiredAnnual: number;
  projectedMonthlySurplus: number;
  projectedAnnualSurplus: number;
  gapMonthly: number;
  gapAnnual: number;
  goalsWithDeadline: GoalRequirement[];
  goalsWithoutDeadline: DreamPlan[];
  suggestion: CollisionSuggestion | null;
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthsUntil(targetDate: string): number {
  const now = new Date();
  const target = new Date(targetDate);
  const months =
    (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  return Math.max(months, 1);
}

// Trailing 3-month average of (income - expenses) from real transaction history —
// same approach used by the Financial Autopilot card, kept independent here so
// this detector doesn't depend on any particular strategy being created.
async function trailingMonthlySurplus(): Promise<number> {
  const transactions = await getTransactions({});
  const byMonth = new Map<string, { income: number; expense: number }>();
  transactions.forEach((t) => {
    const key = monthKey(t.date);
    const entry = byMonth.get(key) ?? { income: 0, expense: 0 };
    if (t.type === 'income') entry.income += t.amount;
    if (t.type === 'expense') entry.expense += t.amount;
    byMonth.set(key, entry);
  });

  const monthsSorted = Array.from(byMonth.keys()).sort();
  const lastThree = monthsSorted.slice(-3);
  if (lastThree.length === 0) return 0;

  const paces = lastThree.map((k) => {
    const m = byMonth.get(k)!;
    return m.income - m.expense;
  });

  return paces.reduce((a, b) => a + b, 0) / paces.length;
}

// Builds a single "best" suggestion by trying to fix the collision through the
// lowest-priority dated goal alone first (delay it), and only reaching for
// "increase income" if delaying that one goal can't close the gap even if
// pushed arbitrarily far out.
function buildSuggestion(
  goals: GoalRequirement[],
  totalRequiredMonthly: number,
  projectedMonthlySurplus: number
): CollisionSuggestion | null {
  if (goals.length === 0) return null;

  // Lowest priorityWeight = lowest priority = first candidate to delay
  const sorted = [...goals].sort(
    (a, b) => (a.dream.priorityWeight ?? 3) - (b.dream.priorityWeight ?? 3)
  );
  const target = sorted[0];

  const otherRequired = totalRequiredMonthly - target.requiredMonthly;
  const availableForTarget = projectedMonthlySurplus - otherRequired;

  if (availableForTarget > 0) {
    const newMonths = Math.ceil(target.amountRemaining / availableForTarget);
    const delayMonths = Math.max(0, newMonths - target.monthsRemaining);

    if (delayMonths > 0) {
      return {
        type: 'delay',
        targetDream: target.dream,
        delayMonths,
        newProjectedMonths: newMonths,
        message: `Delay "${target.dream.title}" by ${delayMonths} month${delayMonths === 1 ? '' : 's'} — that alone closes the gap without touching your other goals.`,
      };
    }
  }

  // Delaying the lowest-priority goal alone isn't enough (the other goals'
  // required savings already exceed your surplus) — reducing or delaying
  // that one goal further won't fully solve it, so surface the real gap.
  const extraMonthlyNeeded = totalRequiredMonthly - projectedMonthlySurplus;
  return {
    type: 'increase_income',
    targetDream: target.dream,
    extraMonthlyNeeded,
    message: `Even pausing "${target.dream.title}" entirely wouldn't close the gap — your other goals alone need more than your current surplus. You'd need about ${Math.round(extraMonthlyNeeded)} more per month, or delay/reduce more than one goal.`,
  };
}

export async function detectGoalCollision(userId: string): Promise<GoalCollisionResult> {
  const dreams = await getActiveDreamPlans(userId);

  const withDeadline = dreams.filter((d) => !!d.targetDate);
  const withoutDeadline = dreams.filter((d) => !d.targetDate);

  const requirements: GoalRequirement[] = await Promise.all(
    withDeadline.map(async (dream) => {
      const progress = await calculateDreamProgress(dream, 0);
      const monthsRemaining = monthsUntil(dream.targetDate!);
      const requiredMonthly = progress.amountRemaining / monthsRemaining;
      return {
        dream,
        amountRemaining: progress.amountRemaining,
        monthsRemaining,
        requiredMonthly,
      };
    })
  );

  const totalRequiredMonthly = requirements.reduce((sum, r) => sum + r.requiredMonthly, 0);
  const projectedMonthlySurplus = await trailingMonthlySurplus();

  const gapMonthly = totalRequiredMonthly - projectedMonthlySurplus;
  const hasCollision = gapMonthly > 0 && requirements.length > 0;

  return {
    hasCollision,
    totalRequiredMonthly,
    totalRequiredAnnual: totalRequiredMonthly * 12,
    projectedMonthlySurplus,
    projectedAnnualSurplus: projectedMonthlySurplus * 12,
    gapMonthly,
    gapAnnual: gapMonthly * 12,
    goalsWithDeadline: requirements,
    goalsWithoutDeadline: withoutDeadline,
    suggestion: hasCollision
      ? buildSuggestion(requirements, totalRequiredMonthly, projectedMonthlySurplus)
      : null,
  };
}