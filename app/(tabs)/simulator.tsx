// lib/services/simulations.ts
import { getDatabase } from '@/lib/database/sqlite';
import { SimulationResult, SimulationType } from '@/lib/types';

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS simulations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      cost REAL NOT NULL,
      downPayment REAL NOT NULL,
      interestRate REAL NOT NULL,
      termMonths INTEGER NOT NULL,
      monthlyEMI REAL NOT NULL,
      totalInterestPaid REAL NOT NULL,
      totalCost REAL NOT NULL,
      newDebtToIncomeRatio REAL NOT NULL,
      affordabilityVerdict TEXT NOT NULL,
      projectedMonthlyLeftover REAL NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);
  tableReady = true;
}

export async function saveSimulation(sim: SimulationResult): Promise<void> {
  await ensureTable();
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO simulations
      (id, type, label, cost, downPayment, interestRate, termMonths, monthlyEMI, totalInterestPaid, totalCost, newDebtToIncomeRatio, affordabilityVerdict, projectedMonthlyLeftover, createdAt)
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
  await ensureTable();
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM simulations ORDER BY createdAt DESC'
  );
  return rows.map((r) => ({
    id: r.id,
    type: r.type as SimulationType,
    label: r.label,
    cost: r.cost,
    downPayment: r.downPayment,
    interestRate: r.interestRate,
    termMonths: r.termMonths,
    monthlyEMI: r.monthlyEMI,
    totalInterestPaid: r.totalInterestPaid,
    totalCost: r.totalCost,
    newDebtToIncomeRatio: r.newDebtToIncomeRatio,
    affordabilityVerdict: r.affordabilityVerdict,
    projectedMonthlyLeftover: r.projectedMonthlyLeftover,
    createdAt: r.createdAt,
  }));
}

export async function clearSimulationHistory(): Promise<void> {
  await ensureTable();
  const db = await getDatabase();
  await db.runAsync('DELETE FROM simulations');
}