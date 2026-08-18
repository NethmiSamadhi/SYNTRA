// components/FinancialAutopilotCard.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator, TouchableOpacity } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Satellite, AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import { colors, borderRadius, typography, spacing, shadows } from '@/lib/theme';
import { useTheme } from '@/lib/ThemeContext';
import { createAutopilotStrategy, monitorAutopilot, AutopilotStatus } from '@/lib/services/financialAutopilot';
import { useUser } from '@/lib/UserContext';
import { formatCurrency } from '@/lib/types';

export function FinancialAutopilotCard() {
  const { cardBackground, textPrimary, textSecondary, borderColor } = useTheme();
  const { user } = useUser();
  const displayCurrency = (amount: number) => formatCurrency(amount, user?.currency);

  const [goalInput, setGoalInput] = useState('');
  const [monthsInput, setMonthsInput] = useState('12');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<AutopilotStatus | null>(null);

  const handleCreate = async () => {
    const goalAmount = parseFloat(goalInput);
    const targetMonths = parseInt(monthsInput, 10);
    if (!goalAmount || goalAmount <= 0 || !targetMonths || targetMonths <= 0) return;

    setLoading(true);
    try {
      const strategy = await createAutopilotStrategy(goalAmount, targetMonths);
      const result = await monitorAutopilot(strategy);
      setStatus(result);
    } catch (e) {
      console.error('Error creating autopilot strategy:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: cardBackground, borderColor }]}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${colors.primary[500]}15` }]}>
          <Satellite size={20} color={colors.primary[500]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: textPrimary }]}>Financial Autopilot</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>Set a goal, get a monthly strategy</Text>
        </View>
      </View>

      <View style={styles.inputRow}>
        <View style={{ flex: 2 }}>
          <Text style={[styles.inputLabel, { color: textSecondary }]}>Goal amount</Text>
          <TextInput
            style={[styles.input, { color: textPrimary, borderColor }]}
            placeholder="e.g. 5000"
            placeholderTextColor={textSecondary}
            value={goalInput}
            onChangeText={setGoalInput}
            keyboardType="numeric"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.inputLabel, { color: textSecondary }]}>Months</Text>
          <TextInput
            style={[styles.input, { color: textPrimary, borderColor }]}
            placeholder="12"
            placeholderTextColor={textSecondary}
            value={monthsInput}
            onChangeText={setMonthsInput}
            keyboardType="numeric"
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.createButton, { opacity: !goalInput || !monthsInput || loading ? 0.5 : 1 }]}
        onPress={handleCreate}
        disabled={!goalInput || !monthsInput || loading}
      >
        {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.createButtonText}>Create Autopilot Plan</Text>}
      </TouchableOpacity>

      {status && (
        <Animated.View entering={FadeIn.duration(400)} style={styles.resultsSection}>
          <Text style={[styles.strategyTitle, { color: textPrimary }]}>Monthly strategy</Text>
          <View style={styles.breakdownList}>
            <BreakdownRow label="Savings" amount={status.strategy.breakdown.savings} displayCurrency={displayCurrency} textPrimary={textPrimary} />
            {status.strategy.breakdown.debtOverpayment > 0 && (
              <BreakdownRow
                label="Debt overpayment"
                amount={status.strategy.breakdown.debtOverpayment}
                displayCurrency={displayCurrency}
                textPrimary={textPrimary}
              />
            )}
            <BreakdownRow
              label="Emergency fund"
              amount={status.strategy.breakdown.emergencyFund}
              displayCurrency={displayCurrency}
              textPrimary={textPrimary}
            />
            <BreakdownRow
              label="Flexible buffer"
              amount={status.strategy.breakdown.flexibleBuffer}
              displayCurrency={displayCurrency}
              textPrimary={textPrimary}
            />
          </View>

          <View
            style={[
              styles.statusBanner,
              status.onTrack
                ? { backgroundColor: `${colors.success}12`, borderColor: `${colors.success}30` }
                : { backgroundColor: `${colors.warning}12`, borderColor: `${colors.warning}30` },
            ]}
          >
            {status.onTrack ? (
              <>
                <CheckCircle2 size={16} color={colors.success} />
                <Text style={[styles.statusText, { color: textPrimary }]}>
                  You're on track based on your recent saving pace.
                </Text>
              </>
            ) : (
              <>
                <AlertTriangle size={16} color={colors.warning} />
                <Text style={[styles.statusText, { color: textPrimary }]}>{status.warning}</Text>
              </>
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

function BreakdownRow({
  label,
  amount,
  displayCurrency,
  textPrimary,
}: {
  label: string;
  amount: number;
  displayCurrency: (n: number) => string;
  textPrimary: string;
}) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={[styles.breakdownLabel, { color: textPrimary }]}>{label}</Text>
      <Text style={[styles.breakdownAmount, { color: textPrimary }]}>{displayCurrency(amount)}</Text>
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
  subtitle: { fontSize: typography.fontSizes.xs, marginTop: 2 },
  inputRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  inputLabel: { fontSize: typography.fontSizes.xs, marginBottom: 4, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSizes.md,
  },
  createButton: {
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  createButtonText: { color: '#fff', fontWeight: '700', fontSize: typography.fontSizes.sm },
  resultsSection: { marginTop: spacing.lg },
  strategyTitle: { fontSize: typography.fontSizes.sm, fontWeight: '700', marginBottom: spacing.sm },
  breakdownList: { gap: 6, marginBottom: spacing.md },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownLabel: { fontSize: typography.fontSizes.xs },
  breakdownAmount: { fontSize: typography.fontSizes.xs, fontWeight: '700' },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  statusText: { fontSize: typography.fontSizes.xs, lineHeight: 18, flex: 1 },
});