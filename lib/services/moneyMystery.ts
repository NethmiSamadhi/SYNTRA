// lib/services/moneyMystery.ts
import { Transaction } from '@/lib/types';
import { getTransactions } from './transactions';

export interface CategoryFinding {
  category: string;
  amountBefore: number;
  amountAfter: number;
  delta: number;
  status: 'unchanged' | 'up' | 'down';
}

export interface SmallTransactionCulprit {
  category: string;
  count: number;
  total: number;
}

export interface MoneyMysteryReport {
  hasEnoughData: boolean;
  incomeDelta: number;
  savingsDelta: number;
  unexplainedGap: number; // income went up more than savings did
  categoryFindings: CategoryFinding[];
  smallTransactionCulprits: SmallTransactionCulprit[];
  headline: string;
  computedAt: string;
}

const UNCHANGED_THRESHOLD_PCT = 0.05; // within 5% counts as "unchanged"
const SMALL_TRANSACTION_THRESHOLD = 20; // amounts below this count toward the "small purchases" bucket
const SMALL_TRANSACTION_MIN_COUNT = 5; // need at least this many to call it a pattern

function monthBounds(monthsAgo: number): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 1);
  return { start, end };
}

function inRange(dateStr: string, start: Date, end: Date): boolean {
  const t = new Date(dateStr).getTime();
  return t >= start.getTime() && t < end.getTime();
}

function categoryTotals(transactions: Transaction[]): Map<string, number> {
  const totals = new Map<string, number>();
  transactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
    });
  return totals;
}

export async function computeMoneyMystery(): Promise<MoneyMysteryReport> {
  const all = await getTransactions({});

  const thisMonthRange = monthBounds(0);
  const lastMonthRange = monthBounds(1);

  const thisMonth = all.filter((t) => inRange(t.date, thisMonthRange.start, thisMonthRange.end));
  const lastMonth = all.filter((t) => inRange(t.date, lastMonthRange.start, lastMonthRange.end));

  if (thisMonth.length === 0 || lastMonth.length === 0) {
    return {
      hasEnoughData: false,
      incomeDelta: 0,
      savingsDelta: 0,
      unexplainedGap: 0,
      categoryFindings: [],
      smallTransactionCulprits: [],
      headline: 'Not enough data yet to investigate — need at least two months of activity.',
      computedAt: new Date().toISOString(),
    };
  }

  const incomeThis = thisMonth.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const incomeLast = lastMonth.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenseThis = thisMonth.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const expenseLast = lastMonth.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const savingsThis = incomeThis - expenseThis;
  const savingsLast = incomeLast - expenseLast;

  const incomeDelta = incomeThis - incomeLast;
  const savingsDelta = savingsThis - savingsLast;
  const unexplainedGap = Math.max(incomeDelta - savingsDelta, 0);

  // Category-by-category comparison
  const totalsThis = categoryTotals(thisMonth);
  const totalsLast = categoryTotals(lastMonth);
  const allCategories = new Set([...totalsThis.keys(), ...totalsLast.keys()]);

  const categoryFindings: CategoryFinding[] = Array.from(allCategories).map((category) => {
    const amountBefore = totalsLast.get(category) ?? 0;
    const amountAfter = totalsThis.get(category) ?? 0;
    const delta = amountAfter - amountBefore;
    const base = Math.max(amountBefore, 1);
    let status: CategoryFinding['status'] = 'unchanged';
    if (Math.abs(delta) / base > UNCHANGED_THRESHOLD_PCT) {
      status = delta > 0 ? 'up' : 'down';
    }
    return { category, amountBefore, amountAfter, delta, status };
  }).sort((a, b) => b.delta - a.delta);

  // Small-transaction culprit detection: categories where the *increase* is
  // driven by many small purchases rather than one big one
  const smallTxnsThisMonth = thisMonth.filter((t) => t.type === 'expense' && t.amount < SMALL_TRANSACTION_THRESHOLD);
  const smallByCategory = new Map<string, { count: number; total: number }>();
  smallTxnsThisMonth.forEach((t) => {
    const entry = smallByCategory.get(t.category) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += t.amount;
    smallByCategory.set(t.category, entry);
  });

  const smallTransactionCulprits: SmallTransactionCulprit[] = Array.from(smallByCategory.entries())
    .filter(([, v]) => v.count >= SMALL_TRANSACTION_MIN_COUNT)
    .map(([category, v]) => ({ category, count: v.count, total: v.total }))
    .sort((a, b) => b.total - a.total);

  let headline: string;
  if (unexplainedGap <= 0) {
    headline = 'Your savings grew in line with your income this month — no mystery here.';
  } else {
    const topRiser = categoryFindings.find((c) => c.status === 'up');
    headline = topRiser
      ? `Income rose by ${Math.round(incomeDelta)}, but savings only grew by ${Math.round(savingsDelta)} — largely due to ${topRiser.category}.`
      : `Income rose by ${Math.round(incomeDelta)}, but savings only grew by ${Math.round(savingsDelta)}.`;
  }

  return {
    hasEnoughData: true,
    incomeDelta,
    savingsDelta,
    unexplainedGap,
    categoryFindings,
    smallTransactionCulprits,
    headline,
    computedAt: new Date().toISOString(),
  };
}