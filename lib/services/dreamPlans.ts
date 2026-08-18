// lib/services/dreamPlans.ts
import { getDatabase } from '@/lib/database/sqlite';
import { DreamPlan, DreamContribution, DreamCategory, DreamStatus } from '@/lib/types';

let tableReady = false;

async function ensureTables(): Promise<void> {
  if (tableReady) return;
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS dream_plans (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      targetCost REAL NOT NULL,
      targetDate TEXT,
      annualCostGrowthRate REAL NOT NULL DEFAULT 0.04,
      targetDownPaymentPct REAL,
      priorityWeight INTEGER NOT NULL DEFAULT 3,
      status TEXT NOT NULL DEFAULT 'active',
      linkedSimulationId TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      completedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS dream_contributions (
      id TEXT PRIMARY KEY,
      dreamId TEXT NOT NULL,
      amount REAL NOT NULL,
      note TEXT,
      contributedAt TEXT NOT NULL,
      FOREIGN KEY (dreamId) REFERENCES dream_plans(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_contributions_dream ON dream_contributions(dreamId);
  `);
  tableReady = true;
}

// ---- Dream Plans CRUD ----

export async function saveDreamPlan(plan: DreamPlan): Promise<void> {
  await ensureTables();
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO dream_plans
      (id, userId, title, category, targetCost, targetDate, annualCostGrowthRate, targetDownPaymentPct, priorityWeight, status, linkedSimulationId, createdAt, updatedAt, completedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      plan.id,
      plan.userId,
      plan.title,
      plan.category,
      plan.targetCost,
      plan.targetDate ?? null,
      plan.annualCostGrowthRate ?? 0.04,
      plan.targetDownPaymentPct ?? null,
      plan.priorityWeight ?? 3,
      plan.status ?? 'active',
      plan.linkedSimulationId ?? null,
      plan.createdAt,
      new Date().toISOString(),
      plan.completedAt ?? null,
    ]
  );
}

export async function getDreamPlans(userId: string): Promise<DreamPlan[]> {
  await ensureTables();
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM dream_plans WHERE userId = ? ORDER BY createdAt DESC',
    [userId]
  );
  return rows.map(mapDreamRow);
}

export async function getActiveDreamPlans(userId: string): Promise<DreamPlan[]> {
  await ensureTables();
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM dream_plans WHERE userId = ? AND status = 'active' ORDER BY priorityWeight DESC`,
    [userId]
  );
  return rows.map(mapDreamRow);
}

export async function deleteDreamPlan(id: string): Promise<void> {
  await ensureTables();
  const db = await getDatabase();
  await db.runAsync('DELETE FROM dream_plans WHERE id = ?', [id]);
}

function mapDreamRow(r: any): DreamPlan {
  return {
    id: r.id,
    userId: r.userId,
    title: r.title,
    category: r.category as DreamCategory,
    targetCost: r.targetCost,
    targetDate: r.targetDate ?? undefined,
    annualCostGrowthRate: r.annualCostGrowthRate,
    targetDownPaymentPct: r.targetDownPaymentPct ?? undefined,
    priorityWeight: r.priorityWeight,
    status: r.status as DreamStatus,
    linkedSimulationId: r.linkedSimulationId ?? undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    completedAt: r.completedAt ?? undefined,
  };
}

// ---- Contributions ledger ----

export async function addContribution(c: DreamContribution): Promise<void> {
  await ensureTables();
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO dream_contributions (id, dreamId, amount, note, contributedAt)
     VALUES (?, ?, ?, ?, ?)`,
    [c.id, c.dreamId, c.amount, c.note ?? null, c.contributedAt]
  );
}

export async function getContributions(dreamId: string): Promise<DreamContribution[]> {
  await ensureTables();
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM dream_contributions WHERE dreamId = ? ORDER BY contributedAt ASC',
    [dreamId]
  );
  return rows.map((r) => ({
    id: r.id,
    dreamId: r.dreamId,
    amount: r.amount,
    note: r.note ?? undefined,
    contributedAt: r.contributedAt,
  }));
}

export async function getTotalSaved(dreamId: string): Promise<number> {
  await ensureTables();
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(amount), 0) as total FROM dream_contributions WHERE dreamId = ?',
    [dreamId]
  );
  return row?.total ?? 0;
}