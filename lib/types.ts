/**
 * Budget Buddy V2 Types and Constants
 */

export interface Account {
  id: string;
  name: string;
  type: string; // Custom type string (e.g. "Personal", "Business")
  balance: number;
  icon: string; // Emoji or Icon name
  color: string;
}

export interface Transaction {
  id: string;
  amount: number;
  category: string; // Custom category (e.g. "🍱 Lunch", "⛽ Fuel")
  sourceAccountId: string;
  destinationAccountId?: string;
  notes: string;
  date: string;
  type: 'expense' | 'income' | 'transfer';
  warning?: string;
}

export interface AIInsight {
  id: string;
  title: string;
  description: string;
  type: 'recommendation' | 'warning' | 'info' | 'success';
  action?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface MonthlyPlan {
  salary: number;
  essentials: {
    [key: string]: number;
  };
  allocations: {
    [key: string]: number;
  };
}


// Suggested items for better UX (not mandatory)
export const SUGGESTED_CATEGORIES = [
  '🍱 Food', '🚗 Transport', '🛍️ Shopping', '🎬 Entertainment', 
  '💡 Bills', '🏥 Health', '🎓 Education', '💰 Salary', '🔄 Transfer'
];

export const SUGGESTED_ACCOUNT_TYPES = [
  '💳 Spending', '🏦 Savings', '💵 Pocket Money', '📈 Investment', '💼 Salary'
];


// Helper function to format currency dynamically
export const formatCurrency = (amount: number, currency: string = 'Rs.'): string => {
  const formatterOptions: Intl.NumberFormatOptions = {
    maximumFractionDigits: 0,
  };

  // Format number with Indian number system (lakhs, crores) if Rs.
  const locale = currency === 'Rs.' ? 'en-IN' : 'en-US';
  const numeric = new Intl.NumberFormat(locale, formatterOptions).format(amount);
  
  return `${currency} ${numeric}`;
};

// Helper function to calculate total balance
export const calculateNetWorth = (accounts: Account[]): number => {
  return accounts.reduce((total, account) => total + account.balance, 0);
};

export interface EMILoan {
  id: string;
  name: string;
  category: 'Vehicle' | 'Home' | 'Education' | 'Personal' | 'Other';
  principal: number;
  remaining: number;
  interestRate: number;
  termMonths: number;
  startDate: string;
  createdAt: string;
}

export interface EMIScheduleRow {
  monthIndex: number;
  emiAmount: number;
  principalComponent: number;
  interestComponent: number;
  remainingBalance: number;
  dueDate: string;
}

export type SimulationType = 'vehicle' | 'education' | 'travel' | 'home';

export interface SimulationInput {
  type: SimulationType;
  label: string;
  cost: number;
  downPayment: number;
  interestRate: number;
  termMonths: number;
}

export interface SimulationResult {
  id: string;
  type: SimulationType;
  label: string;
  cost: number;
  downPayment: number;
  interestRate: number;
  termMonths: number;
  monthlyEMI: number;
  totalInterestPaid: number;
  totalCost: number;
  newDebtToIncomeRatio: number;
  affordabilityVerdict: 'Affordable' | 'Risky' | 'Not Recommended';
  projectedMonthlyLeftover: number;
  createdAt: string;
}

export interface FinancialHealthScore {
  id: string;
  score: number;
  savingsRateScore: number;
  debtToIncomeScore: number;
  budgetAdherenceScore: number;
  emergencyFundScore: number;
  label: 'Poor' | 'Fair' | 'Good' | 'Excellent';
  computedAt: string;
}