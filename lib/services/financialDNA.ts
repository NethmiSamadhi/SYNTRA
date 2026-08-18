// lib/services/financialDNA.ts
import { Transaction } from '@/lib/types';
import { getTransactions } from './transactions';

export interface FinancialDNAScores {
  planning: number;            // 0-100 — essential-spend ratio + spend regularity
  impulseResistance: number;   // 0-100 — inverse of impulse-category share of spend
  savingsConsistency: number;  // 0-100 — inverse of month-to-month savings variance
  debtDiscipline: number;      // 0-100 — regularity of debt/loan-category payments
  lifestyleVolatility: number; // 0-100 — week-to-week spend variance (higher = more volatile)
}

export interface FinancialDNAPattern {
  id: string;
  description: string;
}

export interface FinancialDNAProfile {
  scores: FinancialDNAScores;
  patterns: FinancialDNAPattern[];
  transactionCount: number;
  computedAt: string;
}

const IMPULSE_KEYWORDS = ['shop', 'entertain', 'delivery', 'takeout', 'coffee', 'snack', 'game'];
const ESSENTIAL_KEYWORDS = ['rent', 'bill', 'grocer', 'health', 'education', 'transport', 'fuel', 'salary'];
const DEBT_KEYWORDS = ['loan', 'emi', 'debt', 'credit'];

const LOOKBACK_DAYS = 90;

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function matchesKeyword(category: string, keywords: string[]): boolean {
  const lower = category.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function weekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - firstDayOfYear.getTime()) / 86400000 + firstDayOfYear.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

// Coefficient of variation, expressed 0-100 (clamped). 0 = perfectly stable.
function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  return clamp((stdDev / mean) * 100);
}

// ---- Individual scores ----

function scorePlanning(expenses: Transaction[]): number {
  if (expenses.length === 0) return 50; // neutral default, not enough data
  const essentialTotal = expenses
    .filter((t) => matchesKeyword(t.category, ESSENTIAL_KEYWORDS))
    .reduce((sum, t) => sum + t.amount, 0);
  const total = expenses.reduce((sum, t) => sum + t.amount, 0);
  const essentialRatio = total > 0 ? essentialTotal / total : 0;

  // Regularity: essential transactions spread evenly across the month suggests
  // budgeted bills rather than reactive spending. Lower day-of-month spread = more regular.
  const essentialDays = expenses
    .filter((t) => matchesKeyword(t.category, ESSENTIAL_KEYWORDS))
    .map((t) => new Date(t.date).getDate());
  const regularityScore = essentialDays.length >= 2 ? 100 - coefficientOfVariation(essentialDays) : 60;

  return Math.round(clamp(essentialRatio * 100 * 0.6 + regularityScore * 0.4));
}

function scoreImpulseResistance(expenses: Transaction[]): number {
  if (expenses.length === 0) return 50;
  const impulseTotal = expenses
    .filter((t) => matchesKeyword(t.category, IMPULSE_KEYWORDS))
    .reduce((sum, t) => sum + t.amount, 0);
  const total = expenses.reduce((sum, t) => sum + t.amount, 0);
  const impulseRatio = total > 0 ? impulseTotal / total : 0;
  return Math.round(clamp(100 - impulseRatio * 100));
}

function scoreSavingsConsistency(transactions: Transaction[]): number {
  const byMonth = new Map<string, { income: number; expense: number }>();
  transactions.forEach((t) => {
    const key = monthKey(t.date);
    const entry = byMonth.get(key) ?? { income: 0, expense: 0 };
    if (t.type === 'income') entry.income += t.amount;
    if (t.type === 'expense') entry.expense += t.amount;
    byMonth.set(key, entry);
  });
  const monthlySavings = Array.from(byMonth.values()).map((m) => m.income - m.expense);
  if (monthlySavings.length < 2) return 50;
  return Math.round(clamp(100 - coefficientOfVariation(monthlySavings.map((s) => Math.abs(s) + 1))));
}

function scoreDebtDiscipline(expenses: Transaction[]): number {
  const debtPayments = expenses.filter((t) => matchesKeyword(t.category, DEBT_KEYWORDS));
  if (debtPayments.length === 0) return 75; // no tracked debt — neutral-positive default
  if (debtPayments.length < 2) return 60;
  const amounts = debtPayments.map((t) => t.amount);
  // Consistent debt payment amounts (low variance) suggest disciplined repayment behavior
  return Math.round(clamp(100 - coefficientOfVariation(amounts)));
}

function scoreLifestyleVolatility(expenses: Transaction[]): number {
  const byWeek = new Map<string, number>();
  expenses.forEach((t) => {
    const key = weekKey(t.date);
    byWeek.set(key, (byWeek.get(key) ?? 0) + t.amount);
  });
  const weeklyTotals = Array.from(byWeek.values());
  if (weeklyTotals.length < 2) return 30; // not enough data — assume low volatility
  return Math.round(coefficientOfVariation(weeklyTotals));
}

// ---- Pattern detection ----

// Finds the days-since-most-recent-income window with the highest average spend,
// e.g. "You tend to overspend 2–4 days after payday."
function detectPaydayOverspendPattern(transactions: Transaction[]): FinancialDNAPattern | null {
  const incomeEvents = transactions
    .filter((t) => t.type === 'income')
    .map((t) => new Date(t.date))
    .sort((a, b) => a.getTime() - b.getTime());

  if (incomeEvents.length === 0) return null;

  const expenseEvents = transactions.filter((t) => t.type === 'expense');
  const spendByOffset = new Map<number, number>(); // days-since-payday -> total spend

  expenseEvents.forEach((t) => {
    const spendDate = new Date(t.date);
    // find the most recent payday before this expense
    let mostRecentPayday: Date | null = null;
    for (const payday of incomeEvents) {
      if (payday.getTime() <= spendDate.getTime()) {
        mostRecentPayday = payday;
      } else break;
    }
    if (!mostRecentPayday) return;
    const offsetDays = Math.round((spendDate.getTime() - mostRecentPayday.getTime()) / 86400000);
    if (offsetDays < 0 || offsetDays > 14) return; // only look at the two weeks after payday
    spendByOffset.set(offsetDays, (spendByOffset.get(offsetDays) ?? 0) + t.amount);
  });

  if (spendByOffset.size < 3) return null;

  // Find the 3-day window with highest total spend
  let bestStart = 0;
  let bestTotal = -1;
  for (let start = 0; start <= 12; start++) {
    const windowTotal = [0, 1, 2].reduce((sum, offset) => sum + (spendByOffset.get(start + offset) ?? 0), 0);
    if (windowTotal > bestTotal) {
      bestTotal = windowTotal;
      bestStart = start;
    }
  }

  const overallAvgPerDay =
    Array.from(spendByOffset.values()).reduce((a, b) => a + b, 0) / spendByOffset.size;
  const windowAvgPerDay = bestTotal / 3;

  // Only surface the pattern if that window is meaningfully above the average pace
  if (windowAvgPerDay < overallAvgPerDay * 1.3) return null;

  return {
    id: 'payday-overspend',
    description: `You tend to spend more ${bestStart}\u2013${bestStart + 2} days after payday.`,
  };
}

function detectVolatilityPattern(volatilityScore: number): FinancialDNAPattern | null {
  if (volatilityScore >= 60) {
    return {
      id: 'high-volatility',
      description: 'Your weekly spending swings widely from week to week — some weeks far higher than others.',
    };
  }
  return null;
}

function detectSavingsPattern(consistencyScore: number, monthsOfData: number): FinancialDNAPattern | null {
  if (monthsOfData < 2) return null;
  if (consistencyScore < 40) {
    return {
      id: 'inconsistent-savings',
      description: 'The amount you save changes a lot month to month, making it harder to predict your progress.',
    };
  }
  if (consistencyScore >= 85) {
    return {
      id: 'stable-savings',
      description: 'You save a strikingly consistent amount every month — a strong, repeatable habit.',
    };
  }
  return null;
}

// ---- Public entry point ----

export async function computeFinancialDNA(): Promise<FinancialDNAProfile> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);

  const allTransactions = await getTransactions({});
  const transactions = allTransactions.filter((t) => new Date(t.date).getTime() >= cutoff.getTime());
  const expenses = transactions.filter((t) => t.type === 'expense');

  const scores: FinancialDNAScores = {
    planning: scorePlanning(expenses),
    impulseResistance: scoreImpulseResistance(expenses),
    savingsConsistency: scoreSavingsConsistency(transactions),
    debtDiscipline: scoreDebtDiscipline(expenses),
    lifestyleVolatility: scoreLifestyleVolatility(expenses),
  };

  const monthsOfData = new Set(transactions.map((t) => monthKey(t.date))).size;

  const patterns = [
    detectPaydayOverspendPattern(transactions),
    detectVolatilityPattern(scores.lifestyleVolatility),
    detectSavingsPattern(scores.savingsConsistency, monthsOfData),
  ].filter((p): p is FinancialDNAPattern => p !== null);

  return {
    scores,
    patterns,
    transactionCount: transactions.length,
    computedAt: new Date().toISOString(),
  };
}