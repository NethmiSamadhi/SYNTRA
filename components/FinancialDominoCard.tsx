// components/FinancialDominoCard.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator, TouchableOpacity } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Zap, ArrowDown } from 'lucide-react-native';
import { colors, borderRadius, typography, spacing, shadows } from '@/lib/theme';
import { useTheme } from '@/lib/ThemeContext';
import { simulatePurchaseImpact, DominoResult } from '@/lib/services/financialDomino';
import { useUser } from '@/lib/UserContext';
import { formatCurrency } from '@/lib/types';

const ALTERNATIVE_DELAY_MONTHS = 3;

export function FinancialDominoCard() {
  const { cardBackground, textPrimary, textSecondary, borderColor } = useTheme();
  const { user } = useUser();
  const displayCurrency = (amount: number) => formatCurrency(amount, user?.currency);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [immediate, setImmediate] = useState<DominoResult | null>(null);
  const [alternative, setAlternative] = useState<DominoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSimulate = async () => {
    const amount = parseFloat(input);
    if (!amount || amount <= 0) return;

    setLoading(true);
    setError(null);
    try {
      const [now, later] = await Promise.all([
        simulatePurchaseImpact(amount, 0),
        simulatePurchaseImpact(amount, ALTERNATIVE_DELAY_MONTHS),
      ]);
      setImmediate(now);
      setAlternative(later);
    } catch (e) {
      console.error('Error simulating domino effect:', e);
      setError('Could not run the simulation. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: cardBackground, borderColor }]}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${colors.warning}15` }]}>
          <Zap size={20} color={colors.warning} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: textPrimary }]}>Financial Domino Effect</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>See what a purchase really costs</Text>
        </View>
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { color: textPrimary, borderColor }]}
          placeholder="e.g. 2000"
          placeholderTextColor={textSecondary}
          value={input}
          onChangeText={setInput}
          keyboardType="numeric"
        />
        <TouchableOpacity
          style={[styles.simulateButton, { opacity: !input || loading ? 0.5 : 1 }]}
          onPress={handleSimulate}
          disabled={!input || loading}
        >
          {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.simulateButtonText}>Simulate</Text>}
        </TouchableOpacity>
      </View>

      {error && <Text style={{ color: colors.error, fontSize: typography.fontSizes.xs, marginTop: spacing.sm }}>{error}</Text>}

      {immediate && (
        <Animated.View entering={FadeIn.duration(400)} style={styles.resultsSection}>
          <Text style={[styles.chainTitle, { color: textPrimary }]}>Buy now</Text>
          <DominoChain result={immediate} textPrimary={textPrimary} textSecondary={textSecondary} />
        </Animated.View>
      )}

      {alternative && (
        <Animated.View entering={FadeIn.duration(400).delay(150)} style={[styles.resultsSection, { marginTop: spacing.lg }]}>
          <Text style={[styles.chainTitle, { color: colors.success }]}>
            Alternative — wait {ALTERNATIVE_DELAY_MONTHS} months
          </Text>
          <DominoChain result={alternative} textPrimary={textPrimary} textSecondary={textSecondary} highlight />
        </Animated.View>
      )}
    </View>
  );
}

function DominoChain({
  result,
  textPrimary,
  textSecondary,
  highlight,
}: {
  result: DominoResult;
  textPrimary: string;
  textSecondary: string;
  highlight?: boolean;
}) {
  return (
    <View
      style={[
        styles.chainBox,
        highlight && { backgroundColor: `${colors.success}0c`, borderColor: `${colors.success}30`, borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.md },
      ]}
    >
      {result.steps.map((step, index) => (
        <View key={step.id}>
          <View style={styles.stepRow}>
            <Text style={[styles.stepLabel, { color: textPrimary }]}>{step.label}</Text>
            <Text style={[styles.stepDetail, { color: textSecondary }]}>{step.detail}</Text>
          </View>
          {index < result.steps.length - 1 && (
            <View style={styles.arrowRow}>
              <ArrowDown size={14} color={textSecondary} />
            </View>
          )}
        </View>
      ))}
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
  inputRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSizes.md,
  },
  simulateButton: {
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simulateButtonText: { color: '#fff', fontWeight: '700', fontSize: typography.fontSizes.sm },
  resultsSection: { marginTop: spacing.lg },
  chainTitle: { fontSize: typography.fontSizes.sm, fontWeight: '700', marginBottom: spacing.sm },
  chainBox: { gap: 2 },
  stepRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  stepLabel: { fontSize: typography.fontSizes.xs, fontWeight: '600', flex: 1 },
  stepDetail: { fontSize: typography.fontSizes.xs, textAlign: 'right', flex: 1 },
  arrowRow: { alignItems: 'center', paddingVertical: 2 },
});