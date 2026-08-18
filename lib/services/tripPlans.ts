// lib/services/tripPlans.ts
import { getDatabase } from '@/lib/database/sqlite';
import * as Crypto from 'expo-crypto';

let tableReady = false;

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS trip_plans (
      id TEXT PRIMARY KEY,
      destination TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      totalBudget REAL NOT NULL,
      dailyCostEstimate REAL NOT NULL,
      styleLabel TEXT NOT NULL,
      accommodationBudget REAL NOT NULL,
      foodBudget REAL NOT NULL,
      activitiesBudget REAL NOT NULL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);
  tableReady = true;
}

export interface SavedTripPlan {
  id: string;
  destination: string;
  lat: number;
  lng: number;
  startDate: string;
  endDate: string;
  totalBudget: number;
  dailyCostEstimate: number;
  styleLabel: string;
  accommodationBudget: number;
  foodBudget: number;
  activitiesBudget: number;
  status: 'planned' | 'completed';
  createdAt: string;
}

export async function saveTripPlan(plan: Omit<SavedTripPlan, 'id' | 'createdAt' | 'status'>): Promise<SavedTripPlan> {
  await ensureTable();
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO trip_plans
      (id, destination, lat, lng, startDate, endDate, totalBudget, dailyCostEstimate, styleLabel, accommodationBudget, foodBudget, activitiesBudget, status, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      plan.destination,
      plan.lat,
      plan.lng,
      plan.startDate,
      plan.endDate,
      plan.totalBudget,
      plan.dailyCostEstimate,
      plan.styleLabel,
      plan.accommodationBudget,
      plan.foodBudget,
      plan.activitiesBudget,
      'planned',
      createdAt,
    ]
  );

  return { ...plan, id, status: 'planned', createdAt };
}

export async function getSavedTrips(): Promise<SavedTripPlan[]> {
  await ensureTable();
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>('SELECT * FROM trip_plans ORDER BY createdAt DESC');
  return rows.map((r) => ({
    id: r.id,
    destination: r.destination,
    lat: r.lat,
    lng: r.lng,
    startDate: r.startDate,
    endDate: r.endDate,
    totalBudget: r.totalBudget,
    dailyCostEstimate: r.dailyCostEstimate,
    styleLabel: r.styleLabel,
    accommodationBudget: r.accommodationBudget,
    foodBudget: r.foodBudget,
    activitiesBudget: r.activitiesBudget,
    status: r.status,
    createdAt: r.createdAt,
  }));
}

export async function deleteTripPlan(id: string): Promise<void> {
  await ensureTable();
  const db = await getDatabase();
  await db.runAsync('DELETE FROM trip_plans WHERE id = ?', [id]);
}

export async function markTripCompleted(id: string): Promise<void> {
  await ensureTable();
  const db = await getDatabase();
  await db.runAsync('UPDATE trip_plans SET status = ? WHERE id = ?', ['completed', id]);
}

export async function getTripActualSpend(startDate: string, endDate: string): Promise<number> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT amount FROM transactions WHERE type = 'expense' AND date >= ? AND date <= ?`,
    [startDate, endDate]
  );
  return rows.reduce((sum, r) => sum + r.amount, 0);
}