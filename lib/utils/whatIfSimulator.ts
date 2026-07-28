// lib/utils/whatIfSimulator.ts
import { SimulationInput, SimulationResult } from '@/lib/types';
import { calculateEMI } from './loanCalculations';

function verdictFor(dti: number, leftover: number): SimulationResult['affordabilityVerdict'] {
  if (dti <= 0.36 && leftover > 0) return 'Affordable';
  if (dti <= 0.45 && leftover >= 0) return 'Risky';
  return 'Not Recommended';
}

export function runWhatIfSimulation(
  input: SimulationInput,
  currentMonthlyIncome: number,
  currentMonthlyExpenses: number
): SimulationResult {
  const financedAmount = Math.max(0, input.cost - input.downPayment);
  const monthlyEMI = calculateEMI(financedAmount, input.interestRate, input.termMonths);
  const totalPaid = monthlyEMI * input.termMonths;
  const totalInterestPaid = Math.round((totalPaid - financedAmount) * 100) / 100;
  const totalCost = Math.round((financedAmount + totalInterestPaid) * 100) / 100;

  const projectedMonthlyExpenses = currentMonthlyExpenses + monthlyEMI;
  const projectedMonthlyLeftover =
    Math.round((currentMonthlyIncome - projectedMonthlyExpenses) * 100) / 100;

  const newDebtToIncomeRatio =
    currentMonthlyIncome > 0
      ? Math.round((monthlyEMI / currentMonthlyIncome) * 1000) / 1000
      : 1;

  return {
    id: `${input.type}-${Date.now()}`,
    type: input.type,
    label: input.label,
    cost: input.cost,
    downPayment: input.downPayment,
    interestRate: input.interestRate,
    termMonths: input.termMonths,
    monthlyEMI,
    totalInterestPaid,
    totalCost,
    newDebtToIncomeRatio,
    affordabilityVerdict: verdictFor(newDebtToIncomeRatio, projectedMonthlyLeftover),
    projectedMonthlyLeftover,
    createdAt: new Date().toISOString(),
  };
}
