// lib/services/emiLoans.ts
import { getDatabase } from '@/lib/database/sqlite';
import * as Crypto from 'expo-crypto';
import { EMILoan } from '@/lib/types';

export async function getEMILoans(): Promise<EMILoan[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>('SELECT * FROM emi_loans ORDER BY created_at DESC');
  return rows.map(rowToEMILoan);
}

export async function getEMILoanById(id: string): Promise<EMILoan | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>('SELECT * FROM emi_loans WHERE id = ?', [id]);
  return row ? rowToEMILoan(row) : null;
}

export async function createEMILoan(
  data: Omit<EMILoan, 'id' | 'createdAt' | 'remaining'>
): Promise<EMILoan> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO emi_loans (id, name, category, principal, remaining, interest_rate, term_months, start_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.name,
      data.category,
      data.principal,
      data.principal, // remaining starts equal to principal
      data.interestRate,
      data.termMonths,
      data.startDate,
      createdAt,
    ]
  );

  return { ...data, id, remaining: data.principal, createdAt };
}

export async function updateEMILoanRemaining(id: string, remaining: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE emi_loans SET remaining = ? WHERE id = ?', [remaining, id]);
}

export async function deleteEMILoan(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM emi_loans WHERE id = ?', [id]);
}

function rowToEMILoan(row: any): EMILoan {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    principal: row.principal,
    remaining: row.remaining,
    interestRate: row.interest_rate,
    termMonths: row.term_months,
    startDate: row.start_date,
    createdAt: row.created_at,
  };
}
import { calculateEMI } from '@/lib/utils/loanCalculations';

export async function getTotalMonthlyEMIPayments(): Promise<number> {
  const loans = await getEMILoans();
  const activeLoans = loans.filter((l) => l.remaining > 0);
  return activeLoans.reduce((sum, loan) => {
    const emi = calculateEMI(loan.principal, loan.interestRate, loan.termMonths);
    return sum + emi;
  }, 0);
}

