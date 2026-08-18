// components/FinancialDNACard.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Dna, Sparkles } from 'lucide-react-native';
import { colors, borderRadius, typography, spacing, shadows } from '@/lib/theme';
import { useTheme } from '@/lib/ThemeContext';
import { computeFinancialDNA, FinancialDNAProfile, FinancialDNAScores } from '@/lib/services/financialDNA';

const METRIC_META: { key: keyof FinancialDNAScores; label: string; invertColor?: boolean }[] = [
  { key: 'planning', label: 'Planning' },
  { key: 'impulseResistance', label: 'Impulse resistance' },
  { key: 'savingsConsistency', label: 'Savings consistency' },
  { key: 'debtDiscipline', label: 'Debt discipline' },
  { key: 'lifestyleVolatility', label: 'Lifestyle volatility', invertColor: true },
];

function scoreColor(value: number, invert?: boolean): string {
  const effective = invert ? 100 - value : value;
  if (effective >= 75) return colors.success;
  if (effective >= 50) return colors.primary[500];
  if (effective >= 30) return colors.warning;
  return colors.error;
}

export function FinancialDNACard() {
  const { cardBackground, textPrimary, textSecondary, borderColor } = useTheme();
  const [profile, setProfile] = useState<FinancialDNAProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const result = await computeFinancialDNA();
      setProfile(result);
    } catch (e) {
      console.error('Error computing Financial DNA:', e);
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

  if (!profile || profile.transactionCount < 5) {
    return (
      <View style={[styles.container, { backgroundColor: cardBackground, borderColor }]}>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: `${colors.primary[500]}15` }]}>
            <Dna size={20} color={colors.primary[500]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: textPrimary }]}>Financial DNA</Text>
            <Text style={[styles.subtitle, { color: textSecondary }]}>Not enough data yet</Text>
          </View>
        </View>
        <Text style={[styles.emptyText, { color: textSecondary }]}>
          Log a few more transactions and your Financial DNA profile will start to take shape.
        </Text>
      </View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(600)} style={[styles.container, { backgroundColor: cardBackground, borderColor }]}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${colors.primary[500]}15` }]}>
          <Dna size={20} color={colors.primary[500]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: textPrimary }]}>Your Financial DNA</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>Based on your last 90 days</Text>
        </View>
      </View>

      <View style={styles.breakdown}>
        {METRIC_META.map((meta) => {
          const value = profile.scores[meta.key];
          const color = scoreColor(value, meta.invertColor);
          return (
            <View key={meta.key} style={styles.metricRow}>
              <View style={styles.metricLabelRow}>
                <Text style={[styles.metricLabel, { color: textSecondary }]}>{meta.label}</Text>
                <Text style={[styles.metricValue, { color }]}>{value}%</Text>
              </View>
              <View style={[styles.track, { backgroundColor: `${color}20` }]}>
                <View style={[styles.fill, { width: `${value}%`, backgroundColor: color }]} />
              </View>
            </View>
          );
        })}
      </View>

      {profile.patterns.length > 0 && (
        <View style={[styles.patternsSection, { borderTopColor: borderColor }]}>
          <View style={styles.patternsHeader}>
            <Sparkles size={14} color={colors.primary[400]} />
            <Text style={[styles.patternsTitle, { color: textPrimary }]}>Patterns we noticed</Text>
          </View>
          {profile.patterns.map((p) => (
            <Text key={p.id} style={[styles.patternText, { color: textSecondary }]}>
              • {p.description}
            </Text>
          ))}
        </View>
      )}
    </Animated.View>
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
  emptyText: { fontSize: typography.fontSizes.sm, lineHeight: 20 },
  breakdown: { gap: spacing.md },
  metricRow: { gap: 6 },
  metricLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metricLabel: { fontSize: typography.fontSizes.xs },
  metricValue: { fontSize: typography.fontSizes.xs, fontWeight: '700' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  patternsSection: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, gap: 6 },
  patternsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  patternsTitle: { fontSize: typography.fontSizes.sm, fontWeight: '700' },
  patternText: { fontSize: typography.fontSizes.xs, lineHeight: 18 },
});