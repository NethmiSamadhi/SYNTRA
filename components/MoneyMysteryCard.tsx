// components/MoneyMysteryCard.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Search } from 'lucide-react-native';
import { colors, borderRadius, typography, spacing, shadows } from '@/lib/theme';
import { useTheme } from '@/lib/ThemeContext';
import { computeMoneyMystery, MoneyMysteryReport, CategoryFinding } from '@/lib/services/moneyMystery';
import { useUser } from '@/lib/UserContext';
import { formatCurrency } from '@/lib/types';

const STATUS_DOT: Record<CategoryFinding['status'], string> = {
  unchanged: '🟢',
  up: '🔴',
  down: '🟡',
};

export function MoneyMysteryCard() {
  const { cardBackground, textPrimary, textSecondary, borderColor } = useTheme();
  const { user } = useUser();
  const displayCurrency = (amount: number) => formatCurrency(amount, user?.currency);

  const [report, setReport] = useState<MoneyMysteryReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const result = await computeMoneyMystery();
      setReport(result);
    } catch (e) {
      console.error('Error computing Money Mystery report:', e);
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

  if (!report) return null;

  const movedCategories = report.categoryFindings.filter((c) => c.status !== 'unchanged').slice(0, 6);

  return (
    <Animated.View entering={FadeIn.duration(600)} style={[styles.container, { backgroundColor: cardBackground, borderColor }]}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${colors.info}15` }]}>
          <Search size={20} color={colors.info} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: textPrimary }]}>Money Mystery Mode</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>🔎 Where did your money disappear?</Text>
        </View>
      </View>

      {!report.hasEnoughData ? (
        <Text style={[styles.emptyText, { color: textSecondary }]}>{report.headline}</Text>
      ) : (
        <>
          <Text style={[styles.headline, { color: textPrimary }]}>{report.headline}</Text>

          {movedCategories.length > 0 && (
            <View style={styles.investigationSection}>
              <Text style={[styles.sectionLabel, { color: textSecondary }]}>Investigation</Text>
              {movedCategories.map((c) => (
                <View key={c.category} style={styles.categoryRow}>
                  <Text style={[styles.categoryText, { color: textPrimary }]}>
                    {STATUS_DOT[c.status]} {c.category}
                  </Text>
                  <Text style={[styles.categoryDelta, { color: c.delta > 0 ? colors.error : colors.success }]}>
                    {c.delta > 0 ? '+' : ''}
                    {displayCurrency(c.delta)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {report.smallTransactionCulprits.length > 0 && (
            <View style={[styles.mysterySolved, { backgroundColor: `${colors.warning}12`, borderColor: `${colors.warning}30` }]}>
              <Text style={[styles.mysterySolvedLabel, { color: textPrimary }]}>Mystery solved</Text>
              {report.smallTransactionCulprits.map((c) => (
                <Text key={c.category} style={[styles.mysterySolvedText, { color: textSecondary }]}>
                  {displayCurrency(c.total)} came from {c.count} small "{c.category}" purchases
                </Text>
              ))}
            </View>
          )}
        </>
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
  subtitle: { fontSize: typography.fontSizes.xs, marginTop: 2 },
  emptyText: { fontSize: typography.fontSizes.sm, lineHeight: 20 },
  headline: { fontSize: typography.fontSizes.sm, lineHeight: 20, marginBottom: spacing.md },
  investigationSection: { gap: 6, marginBottom: spacing.md },
  sectionLabel: { fontSize: typography.fontSizes.xs, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  categoryText: { fontSize: typography.fontSizes.xs },
  categoryDelta: { fontSize: typography.fontSizes.xs, fontWeight: '700' },
  mysterySolved: { padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, gap: 4 },
  mysterySolvedLabel: { fontSize: typography.fontSizes.sm, fontWeight: '700', marginBottom: 2 },
  mysterySolvedText: { fontSize: typography.fontSizes.xs, lineHeight: 18 },
});