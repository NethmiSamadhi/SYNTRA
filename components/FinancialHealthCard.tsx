// components/FinancialHealthCard.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { HeartPulse } from 'lucide-react-native';
import { colors, borderRadius, typography, spacing, shadows } from '@/lib/theme';
import { useTheme } from '@/lib/ThemeContext';
import { CircularProgress } from '@/components/CircularProgress';
import { computeFinancialHealthScore, FHSInputs } from '@/lib/utils/financialHealthScore';
import { totalMonthlyEMIObligation } from '@/lib/utils/loanCalculations';
import { getCurrentMonthlyPlan } from '@/lib/services/monthlyPlans';
import { getTransactions } from '@/lib/services/transactions';
import { getEMILoans } from '@/lib/services/emiLoans';
import { getAccounts } from '@/lib/services/accounts';
import { FinancialHealthScore } from '@/lib/types';

const LABEL_COLOR: Record<FinancialHealthScore['label'], string> = {
  Excellent: colors.success,
  Good: colors.primary[500],
  Fair: colors.warning,
  Poor: colors.error,
};

export function FinancialHealthCard() {
  const { cardBackground, textPrimary, textSecondary, borderColor } = useTheme();
  const [result, setResult] = useState<Omit<FinancialHealthScore, 'id'> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const [plan, transactions, emiLoans, accounts] = await Promise.all([
        getCurrentMonthlyPlan(),
        getTransactions({}),
        getEMILoans(),
        getAccounts(),
      ]);

      const totalMonthlyDebtPayments = totalMonthlyEMIObligation(emiLoans);

      const now = new Date();
      const monthlyExpenses = transactions
        .filter((t) => {
          const d = new Date(t.date);
          return t.type === 'expense' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((sum, t) => sum + t.amount, 0);

      const monthlyIncome = plan?.salary ?? 0;
      const monthlyEssentialExpenses = plan
        ? Object.values(plan.essentials).reduce((a, b) => a + b, 0)
        : monthlyExpenses;
      const budgetedAmount = plan
        ? plan.allocations.spending + monthlyEssentialExpenses
        : monthlyExpenses;

      const savingsAccount = accounts.find((a) => a.type === 'savings');
      const monthlySavings = Math.max(monthlyIncome - monthlyExpenses, 0);

      const inputs: FHSInputs = {
        monthlyIncome,
        monthlyExpenses,
        monthlySavings,
        totalMonthlyDebtPayments,
        budgetedAmount,
        actualSpend: monthlyExpenses,
        emergencyFundBalance: savingsAccount?.balance ?? 0,
        monthlyEssentialExpenses,
      };

      setResult(computeFinancialHealthScore(inputs));
    } catch (e) {
      console.error('Error computing financial health score:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: cardBackground, borderColor }]}>
        <ActivityIndicator color={colors.primary[500]} />
      </View>
    );
  }

  if (!result) return null;

  const color = LABEL_COLOR[result.label];

  return (
    <Animated.View entering={FadeIn.duration(600)} style={[styles.container, { backgroundColor: cardBackground, borderColor }]}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <HeartPulse size={20} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: textPrimary }]}>Financial Health</Text>
          <Text style={[styles.subtitle, { color }]}>{result.label}</Text>
        </View>
        <CircularProgress percentage={result.score} size={56} strokeWidth={6} color={color} value={String(result.score)} />
      </View>

      <View style={styles.breakdown}>
        <BreakdownRow label="Savings Rate" score={result.savingsRateScore} max={30} textSecondary={textSecondary} />
        <BreakdownRow label="Debt-to-Income" score={result.debtToIncomeScore} max={25} textSecondary={textSecondary} />
        <BreakdownRow label="Budget Adherence" score={result.budgetAdherenceScore} max={25} textSecondary={textSecondary} />
        <BreakdownRow label="Emergency Fund" score={result.emergencyFundScore} max={20} textSecondary={textSecondary} />
      </View>
    </Animated.View>
  );
}

function BreakdownRow({ label, score, max, textSecondary }: { label: string; score: number; max: number; textSecondary: string }) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={[styles.breakdownLabel, { color: textSecondary }]}>{label}</Text>
      <Text style={[styles.breakdownScore, { color: textSecondary }]}>{score}/{max}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.xl,
    padding: spacing.xl,
    borderRadius: borderRadius['3xl'],
    marginBottom: spacing.lg,
    borderWidth: 1,
    ...shadows.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  iconContainer: { width: 44, height: 44, borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: typography.fontSizes.md, fontWeight: typography.fontWeights.bold },
  subtitle: { fontSize: typography.fontSizes.sm, fontWeight: '600', marginTop: 2 },
  breakdown: { gap: spacing.sm },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownLabel: { fontSize: typography.fontSizes.xs },
  breakdownScore: { fontSize: typography.fontSizes.xs, fontWeight: '600' },
});