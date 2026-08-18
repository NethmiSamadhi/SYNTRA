// components/GhostMoneyCard.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ghost } from 'lucide-react-native';
import { colors, borderRadius, typography, spacing, shadows } from '@/lib/theme';
import { useTheme } from '@/lib/ThemeContext';
import { computeGhostMoney, GhostMoneyBreakdown } from '@/lib/services/ghostMoney';
import { useUser } from '@/lib/UserContext';
import { formatCurrency } from '@/lib/types';

export function GhostMoneyCard() {
  const { cardBackground, textPrimary, textSecondary, borderColor } = useTheme();
  const { user } = useUser();
  const [breakdown, setBreakdown] = useState<GhostMoneyBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  const displayCurrency = (amount: number) => formatCurrency(amount, user?.currency);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const result = await computeGhostMoney();
      setBreakdown(result);
    } catch (e) {
      console.error('Error computing Ghost Money:', e);
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

  if (!breakdown) return null;

  const { actualBalance, ghostMoneyTotal, safeBalance, items } = breakdown;
  const ghostPct = actualBalance > 0 ? Math.min(100, Math.round((ghostMoneyTotal / actualBalance) * 100)) : 0;

  return (
    <Animated.View entering={FadeIn.duration(600)} style={[styles.container, { backgroundColor: cardBackground, borderColor }]}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${colors.info}15` }]}>
          <Ghost size={20} color={colors.info} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: textPrimary }]}>Ghost Money</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>Money that looks available but isn't</Text>
        </View>
      </View>

      <View style={styles.balanceRow}>
        <View style={styles.balanceItem}>
          <Text style={[styles.balanceLabel, { color: textSecondary }]}>Bank Balance</Text>
          <Text style={[styles.balanceValue, { color: textPrimary }]}>{displayCurrency(actualBalance)}</Text>
        </View>
        <View style={styles.balanceItem}>
          <Text style={[styles.balanceLabel, { color: textSecondary }]}>👻 Ghost Money</Text>
          <Text style={[styles.balanceValue, { color: colors.warning }]}>{displayCurrency(ghostMoneyTotal)}</Text>
        </View>
      </View>

      {items.length > 0 && (
        <View style={styles.itemsList}>
          {items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={[styles.itemLabel, { color: textSecondary }]}>→ {item.label}</Text>
              <Text style={[styles.itemAmount, { color: textSecondary }]}>{displayCurrency(item.amount)}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.track, { backgroundColor: `${colors.warning}20` }]}>
        <View style={[styles.fill, { width: `${ghostPct}%`, backgroundColor: colors.warning }]} />
      </View>

      <View style={[styles.safeBanner, { backgroundColor: `${colors.success}12`, borderColor: `${colors.success}30` }]}>
        <Text style={[styles.safeLabel, { color: textSecondary }]}>Real disposable money</Text>
        <Text style={[styles.safeValue, { color: colors.success }]}>{displayCurrency(safeBalance)}</Text>
      </View>
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
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  balanceItem: { gap: 2 },
  balanceLabel: { fontSize: typography.fontSizes.xs },
  balanceValue: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.bold },
  itemsList: { gap: 6, marginBottom: spacing.md },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between' },
  itemLabel: { fontSize: typography.fontSizes.xs },
  itemAmount: { fontSize: typography.fontSizes.xs, fontWeight: '600' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: spacing.md },
  fill: { height: '100%', borderRadius: 3 },
  safeBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  safeLabel: { fontSize: typography.fontSizes.sm, fontWeight: '600' },
  safeValue: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.bold },
});