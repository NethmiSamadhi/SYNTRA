
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

const DB_NAME = 'budget_buddy.db';

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Initialize the database and create tables if they don't exist
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  db = await SQLite.openDatabaseAsync(DB_NAME);

  // Enable foreign keys
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Create tables
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      last_updated TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      source_account_id TEXT NOT NULL,
      destination_account_id TEXT,
      notes TEXT,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      FOREIGN KEY (source_account_id) REFERENCES accounts (id) ON DELETE CASCADE,
      FOREIGN KEY (destination_account_id) REFERENCES accounts (id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS monthly_plans (
      id TEXT PRIMARY KEY NOT NULL,
      salary REAL NOT NULL DEFAULT 0,
      essentials TEXT NOT NULL, -- JSON string
      allocations TEXT NOT NULL, -- JSON string
      month TEXT NOT NULL,
      year INTEGER NOT NULL,
      UNIQUE(month, year)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS loans (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      principal REAL NOT NULL,
      remaining REAL NOT NULL,
      interest_rate REAL NOT NULL DEFAULT 0,
      due_date TEXT,
      lender_borrower TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      type TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
     CREATE TABLE IF NOT EXISTS emi_loans (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      principal REAL NOT NULL,
      remaining REAL NOT NULL,
      interest_rate REAL NOT NULL DEFAULT 0,
      term_months INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS simulations (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      cost REAL NOT NULL,
      down_payment REAL NOT NULL,
      interest_rate REAL NOT NULL,
      term_months INTEGER NOT NULL,
      monthly_emi REAL NOT NULL,
      total_interest_paid REAL NOT NULL,
      total_cost REAL NOT NULL,
      new_dti_ratio REAL NOT NULL,
      verdict TEXT NOT NULL,
      projected_leftover REAL NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS health_scores (
      id TEXT PRIMARY KEY NOT NULL,
      score REAL NOT NULL,
      savings_rate_score REAL NOT NULL,
      debt_to_income_score REAL NOT NULL,
      budget_adherence_score REAL NOT NULL,
      emergency_fund_score REAL NOT NULL,
      label TEXT NOT NULL,
      computed_at TEXT NOT NULL
    );
  `);

  console.log('Database initialized successfully');
  return db;
}

/**
 * Get the database instance
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    return initDatabase();
  }
  return db;
}

export async function runInTransaction<T>(
  action: (db: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  const database = await getDatabase();
  let result: T;
  await database.withTransactionAsync(async () => {
    result = await action(database);
  });
  return result!;
}