import { DreamContribution } from '@/lib/types';
import { getContributions } from './dreamPlans';
import { calculateAllDreamProgress, DreamProgress } from './dreamProgress';

export interface DreamStreak {
  dreamId: string;
  currentStreakMonths: number;
  longestStreakMonths: number;
  lastContributionMonth: string | null; // 'YYYY-MM'
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function previousMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Counts consecutive months (ending this month or last month) with at least
// one positive contribution. Breaks the streak the moment a month is skipped.
export function calculateStreakFromContributions(contributions: DreamContribution[]): DreamStreak {
  const deposits = contributions.filter((c) => c.amount > 0);
  if (deposits.length === 0) {
    return { dreamId: '', currentStreakMonths: 0, longestStreakMonths: 0, lastContributionMonth: null };
  }

  const monthsWithDeposits = new Set(deposits.map((c) => monthKey(c.contributedAt)));
  const sortedMonths = Array.from(monthsWithDeposits).sort();

  // Longest streak: scan chronologically for consecutive runs
  let longest = 1;
  let running = 1;
  for (let i = 1; i < sortedMonths.length; i++) {
    if (previousMonthKey(sortedMonths[i]) === sortedMonths[i - 1]) {
      running++;
      longest = Math.max(longest, running);
    } else {
      running = 1;
    }
  }

  // Current streak: walk backward from this month (or last month, so a streak
  // isn't wiped out just because this month hasn't happened yet)
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = previousMonthKey(thisMonth);

  let cursor = monthsWithDeposits.has(thisMonth) ? thisMonth : monthsWithDeposits.has(lastMonth) ? lastMonth : null;
  let current = 0;
  while (cursor && monthsWithDeposits.has(cursor)) {
    current++;
    cursor = previousMonthKey(cursor);
  }

  return {
    dreamId: '',
    currentStreakMonths: current,
    longestStreakMonths: longest,
    lastContributionMonth: sortedMonths[sortedMonths.length - 1],
  };
}

export async function getDreamStreak(dreamId: string): Promise<DreamStreak> {
  const contributions = await getContributions(dreamId);
  const streak = calculateStreakFromContributions(contributions);
  return { ...streak, dreamId };
}

// ---- Dream of the Month ----

export interface DreamOfTheMonth {
  progress: DreamProgress;
  thisMonthContributed: number;
  reason: 'fastest_pace' | 'biggest_jump' | 'closest_to_goal';
}

// Picks the standout active dream for this month. Priority:
// 1. Whichever dream received the most in actual contributions this month
// 2. Tie-break: whichever is closest to completion (most motivating to highlight)
export async function getDreamOfTheMonth(
  userId: string,
  totalMonthlySavingsCapacity: number
): Promise<DreamOfTheMonth | null> {
  const allProgress = await calculateAllDreamProgress(userId, totalMonthlySavingsCapacity);
  if (allProgress.length === 0) return null;

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const withThisMonth = await Promise.all(
    allProgress.map(async (p) => {
      const contributions = await getContributions(p.dream.id);
      const thisMonthTotal = contributions
        .filter((c) => monthKey(c.contributedAt) === thisMonthKey && c.amount > 0)
        .reduce((sum, c) => sum + c.amount, 0);
      return { progress: p, thisMonthContributed: thisMonthTotal };
    })
  );

  const withActivity = withThisMonth.filter((w) => w.thisMonthContributed > 0);
  if (withActivity.length === 0) return null;

  withActivity.sort((a, b) => {
    if (b.thisMonthContributed !== a.thisMonthContributed) {
      return b.thisMonthContributed - a.thisMonthContributed;
    }
    return b.progress.progressPct - a.progress.progressPct; // tie-break: closer to done
  });

  const winner = withActivity[0];
  return {
    progress: winner.progress,
    thisMonthContributed: winner.thisMonthContributed,
    reason: 'fastest_pace',
  };
}