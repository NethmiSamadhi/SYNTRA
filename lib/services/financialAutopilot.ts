// lib/services/financialAutopilot.ts
import { getTransactions } from './transactions';
import { getEMILoans } from './emiLoans';
import { getAccounts } from './accounts';
import { totalMonthlyEMIObligation } from '@/lib/utils/loanCalculations';

export interface AutopilotBreakdown {
  savings: number;
  debtOverpayment: number;
  emergencyFund: number;
  flexibleBuffer: number;
}

export interface AutopilotStrategy {
  goalAmount: number;
  targetMonths: number;
  monthlyNeeded: number;
  breakdown: AutopilotBreakdown;
  createdAt: string;
}

export interface AutopilotStatus {
  strategy: AutopilotStrategy;
  actualMonthlyPace: number; // trailing 3-month average savings
  monthsElapsedEstimate: number;
  projectedTotal: number; // what you'll actually have by target date at current pace
  projectedShortfall: number; // positive = behind target, 0 = on track or ahead
  onTrack: boolean;
  suggestedWeeklyAdjustment: number | null;
  warning: string | null;
}

const HAS_DEBT_DEBT_SHARE = 0.15;
const NO_DEBT_SAVINGS_SHARE = 0.8;
const WITH_DEBT_SAVINGS_SHARE = 0.65;
const EMERGENCY_FUND_SHARE = 0.1;
// flexible buffer takes whatever remains

/**
 * Builds a monthly savings strategy for a stated goal, splitting the required
 * monthly amount across savings, debt overpayment (if debt exists), emergency
 * fund top-up, and a flexible buffer.
 */
export async function createAutopilotStrategy(goalAmount: number, targetMonths: number): Promise<AutopilotStrategy> {
  const monthlyNeeded = goalAmount / Math.max(targetMonths, 1);
  const emiLoans = await getEMILoans();
  const hasDebt = totalMonthlyEMIObligation(emiLoans) > 0;

  const savingsShare = hasDebt ? WITH_DEBT_SAVINGS_SHARE : NO_DEBT_SAVINGS_SHARE;
  const debtShare = hasDebt ? HAS_DEBT_DEBT_SHARE : 0;
  const emergencyShare = EMERGENCY_FUND_SHARE;
  const bufferShare = Math.max(1 - savingsShare - debtShare - emergencyShare, 0);

  const breakdown: AutopilotBreakdown = {
    savings: Math.round(monthlyNeeded * savingsShare),
    debtOverpayment: Math.round(monthlyNeeded * debtShare),
    emergencyFund: Math.round(monthlyNeeded * emergencyShare),
    flexibleBuffer: Math.round(monthlyNeeded * bufferShare),
  };

  return {
    goalAmount,
    targetMonths,
    monthlyNeeded: Math.round(monthlyNeeded),
    breakdown,
    createdAt: new Date().toISOString(),
  };
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Compares real trailing spending behavior against the strategy's required
 * pace and flags if the user is on track to miss the goal.
 */
export async function monitorAutopilot(strategy: AutopilotStrategy): Promise<AutopilotStatus> {
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
  const paces = lastThree.map((k) => {
    const m = byMonth.get(k)!;
    return m.income - m.expense;
  });

  const actualMonthlyPace = paces.length > 0 ? paces.reduce((a, b) => a + b, 0) / paces.length : 0;

  // Estimate how many months have elapsed since the strategy was created
  const createdDate = new Date(strategy.createdAt);
  const now = new Date();
  const monthsElapsedEstimate = Math.max(
    (now.getFullYear() - createdDate.getFullYear()) * 12 + (now.getMonth() - createdDate.getMonth()),
    0
  );

  const projectedTotal = actualMonthlyPace * strategy.targetMonths;
  const projectedShortfall = Math.max(strategy.goalAmount - projectedTotal, 0);
  const onTrack = projectedShortfall <= 0;

  let suggestedWeeklyAdjustment: number | null = null;
  let warning: string | null = null;

  if (!onTrack) {
    const remainingMonths = Math.max(strategy.targetMonths - monthsElapsedEstimate, 1);
    const remainingWeeks = remainingMonths * 4.33;
    suggestedWeeklyAdjustment = Math.round(projectedShortfall / remainingWeeks);
    warning = `Your current behaviour will cause you to miss your target by ${Math.round(projectedShortfall)}. Suggested adjustment: reduce discretionary spending by ${suggestedWeeklyAdjustment}/week.`;
  }

  return {
    strategy,
    actualMonthlyPace,
    monthsElapsedEstimate,
    projectedTotal,
    projectedShortfall,
    onTrack,
    suggestedWeeklyAdjustment,
    warning,
  };
}