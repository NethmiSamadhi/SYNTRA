// lib/utils/loanCalculations.ts
import { EMILoan, EMIScheduleRow } from '@/lib/types';

/** EMI = P * r * (1+r)^n / ((1+r)^n - 1), reducing-balance method */
export function calculateEMI(
  principal: number,
  annualInterestRate: number,
  termMonths: number
): number {
  if (termMonths <= 0) return 0;
  if (annualInterestRate === 0) return Math.round((principal / termMonths) * 100) / 100;
  const monthlyRate = annualInterestRate / 12 / 100;
  const factor = Math.pow(1 + monthlyRate, termMonths);
  const emi = (principal * monthlyRate * factor) / (factor - 1);
  return Math.round(emi * 100) / 100;
}

export function generateAmortizationSchedule(loan: EMILoan): EMIScheduleRow[] {
  const monthlyRate = loan.interestRate / 12 / 100;
  const emi = calculateEMI(loan.principal, loan.interestRate, loan.termMonths);
  const start = new Date(loan.startDate || loan.createdAt);

  let balance = loan.principal;
  const schedule: EMIScheduleRow[] = [];

  for (let month = 1; month <= loan.termMonths; month++) {
    const interestComponent = Math.round(balance * monthlyRate * 100) / 100;
    let principalComponent = Math.round((emi - interestComponent) * 100) / 100;

    if (month === loan.termMonths) {
      principalComponent = Math.round(balance * 100) / 100; // settle rounding drift
    }

    balance = Math.max(0, Math.round((balance - principalComponent) * 100) / 100);

    const dueDate = new Date(start);
    dueDate.setMonth(dueDate.getMonth() + month);

    schedule.push({
      monthIndex: month,
      emiAmount: month === loan.termMonths ? principalComponent + interestComponent : emi,
      principalComponent,
      interestComponent,
      remainingBalance: balance,
      dueDate: dueDate.toISOString(),
    });
  }

  return schedule;
}

export function totalInterestPaid(loan: EMILoan): number {
  const total = generateAmortizationSchedule(loan).reduce((sum, r) => sum + r.interestComponent, 0);
  return Math.round(total * 100) / 100;
}

export function totalMonthlyEMIObligation(loans: EMILoan[]): number {
  const total = loans.reduce(
    (sum, loan) => sum + calculateEMI(loan.principal, loan.interestRate, loan.termMonths),
    0
  );
  return Math.round(total * 100) / 100;
}