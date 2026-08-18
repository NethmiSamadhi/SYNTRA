// lib/services/simulations.ts
import { getDatabase } from '@/lib/database/sqlite';
import { SimulationResult, SimulationType } from '@/lib/types';

// No ensureTable() here — the `simulations` table is owned by
// lib/database/sqlite.ts and created once at app init.

export async function saveSimulation(sim: SimulationResult): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO simulations
      (id, type, label, cost, down_payment, interest_rate, term_months, monthly_emi, total_interest_paid, total_cost, new_dti_ratio, verdict, projected_leftover, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sim.id,
      sim.type,
      sim.label,
      sim.cost,
      sim.downPayment,
      sim.interestRate,
      sim.termMonths,
      sim.monthlyEMI,
      sim.totalInterestPaid,
      sim.totalCost,
      sim.newDebtToIncomeRatio,
      sim.affordabilityVerdict,
      sim.projectedMonthlyLeftover,
      sim.createdAt,
    ]
  );
}

export async function getSimulationHistory(): Promise<SimulationResult[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM simulations ORDER BY created_at DESC'
  );
  return rows.map((r) => ({
    id: r.id,
    type: r.type as SimulationType,
    label: r.label,
    cost: r.cost,
    downPayment: r.down_payment,
    interestRate: r.interest_rate,
    termMonths: r.term_months,
    monthlyEMI: r.monthly_emi,
    totalInterestPaid: r.total_interest_paid,
    totalCost: r.total_cost,
    newDebtToIncomeRatio: r.new_dti_ratio,
    affordabilityVerdict: r.verdict,
    projectedMonthlyLeftover: r.projected_leftover,
    createdAt: r.created_at,
  }));
}

export async function clearSimulationHistory(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM simulations');
}