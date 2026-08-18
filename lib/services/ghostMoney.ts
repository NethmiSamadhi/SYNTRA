// lib/services/ghostMoney.ts
import { Account, calculateNetWorth } from '@/lib/types';
import { getAccounts } from './accounts';
import { getCurrentMonthlyPlan } from './monthlyPlans';
import { getEMILoans } from './emiLoans';
import { totalMonthlyEMIObligation } from '@/lib/utils/loanCalculations';

export interface GhostMoneyItem {
  id: string;
  label: string;
  amount: number;
}

export interface GhostMoneyBreakdown {
  actualBalance: number;
  ghostMoneyTotal: number;
  safeBalance: number;
  items: GhostMoneyItem[];
  computedAt: string;
}

const RENT_KEYWORDS = ['rent', 'mortgage', 'housing'];
const SUBSCRIPTION_KEYWORDS = ['subscription', 'streaming', 'membership'];
const SAVINGS_KEYWORDS = ['saving', 'invest', 'emergency'];

function matchesAny(key: string, keywords: string[]): boolean {
  const lower = key.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

/**
 * Computes the gap between what's actually in your accounts and what's
 * genuinely safe to spend — money already earmarked for rent, bills,
 * subscriptions, loan payments, and planned savings.
 */
export async function computeGhostMoney(): Promise<GhostMoneyBreakdown> {
  const [accounts, plan, emiLoans] = await Promise.all([
    getAccounts(),
    getCurrentMonthlyPlan(),
    getEMILoans(),
  ]);

  const accountList: Account[] = accounts.map((a: any) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    balance: a.balance,
    icon: a.icon,
    color: a.color,
  }));

  const actualBalance = calculateNetWorth(accountList);
  const items: GhostMoneyItem[] = [];

  if (plan) {
    let rentTotal = 0;
    let subscriptionTotal = 0;
    let otherBillsTotal = 0;

    Object.entries(plan.essentials).forEach(([key, amount]) => {
      const value = Number(amount) || 0;
      if (matchesAny(key, RENT_KEYWORDS)) rentTotal += value;
      else if (matchesAny(key, SUBSCRIPTION_KEYWORDS)) subscriptionTotal += value;
      else otherBillsTotal += value;
    });

    if (rentTotal > 0) items.push({ id: 'rent', label: 'Upcoming rent', amount: rentTotal });
    if (otherBillsTotal > 0) items.push({ id: 'bills', label: 'Bills', amount: otherBillsTotal });
    if (subscriptionTotal > 0) items.push({ id: 'subscriptions', label: 'Subscriptions', amount: subscriptionTotal });

    let savingsTotal = 0;
    Object.entries(plan.allocations).forEach(([key, amount]) => {
      const value = Number(amount) || 0;
      if (matchesAny(key, SAVINGS_KEYWORDS)) savingsTotal += value;
    });
    if (savingsTotal > 0) items.push({ id: 'planned-savings', label: 'Planned savings', amount: savingsTotal });
  }

  const emiTotal = totalMonthlyEMIObligation(emiLoans);
  if (emiTotal > 0) items.push({ id: 'loan', label: 'Loan payments', amount: emiTotal });

  const ghostMoneyTotal = items.reduce((sum, item) => sum + item.amount, 0);
  const safeBalance = Math.max(actualBalance - ghostMoneyTotal, 0);

  return {
    actualBalance,
    ghostMoneyTotal,
    safeBalance,
    items,
    computedAt: new Date().toISOString(),
  };
}