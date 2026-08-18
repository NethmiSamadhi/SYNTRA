// components/FutureSelfCard.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Clock, Sparkles, CheckCircle2 } from 'lucide-react-native';
import { colors, borderRadius, typography, spacing, shadows } from '@/lib/theme';
import { useTheme } from '@/lib/ThemeContext';
import { getFutureSelfProfile, FutureSelfProfile } from '@/lib/services/futureSelf';
import { useUser } from '@/lib/UserContext';
import { formatCurrency } from '@/lib/types';

export function FutureSelfCard() {
  const { cardBackground, textPrimary, textSecondary, borderColor } = useTheme();
  const { user } = useUser();
  const displayCurrency = (amount: number) => formatCurrency(amount, user?.currency);

  const [profile, setProfile] = useState<FutureSelfProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const result = await getFutureSelfProfile();
      setProfile(result);
    } catch (e) {
      console.error('Error computing Future Self profile:', e);
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

  if (!profile) return null;

  return (
    <Animated.View entering={FadeIn.duration(600)} style={[styles.container, { backgroundColor: cardBackground, borderColor }]}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${colors.primary[500]}15` }]}>
          <Clock size={20} color={colors.primary[500]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: textPrimary }]}>Show Me My Future Self</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>YOU — {profile.horizonLabel}</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatBox label="💰 Savings" value={displayCurrency(profile.projectedSavings)} textPrimary={textPrimary} textSecondary={textSecondary} />
        <StatBox label="💳 Debt" value={displayCurrency(profile.projectedDebtRemaining)} textPrimary={textPrimary} textSecondary={textSecondary} />
        <StatBox
          label="🏦 Emergency fund"
          value={`${profile.emergencyFundMonths.toFixed(1)} months`}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
        />
        <StatBox label="❤️ Financial Health" value={`${profile.projectedHealthScore}`} textPrimary={textPrimary} textSecondary={textSecondary} />
      </View>

      {profile.goalsCompletedByThen.length > 0 && (
        <View style={styles.goalsSection}>
          {profile.goalsCompletedByThen.map((title) => (
            <View key={title} style={styles.goalRow}>
              <CheckCircle2 size={14} color={colors.success} />
              <Text style={[styles.goalText, { color: textPrimary }]}>{title}: Completed</Text>
            </View>
          ))}
        </View>
      )}

      {profile.causes.length > 0 && (
        <View style={[styles.causesSection, { borderTopColor: borderColor }]}>
          <View style={styles.causesHeader}>
            <Sparkles size={14} color={colors.primary[400]} />
            <Text style={[styles.causesTitle, { color: textPrimary }]}>What caused this future?</Text>
          </View>
          {profile.causes.map((c) => (
            <Text key={c.id} style={[styles.causeText, { color: textSecondary }]}>
              • {c.description}
            </Text>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

function StatBox({
  label,
  value,
  textPrimary,
  textSecondary,
}: {
  label: string;
  value: string;
  textPrimary: string;
  textSecondary: string;
}) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statLabel, { color: textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: textPrimary }]}>{value}</Text>
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
  subtitle: { fontSize: typography.fontSizes.sm, fontWeight: '700', marginTop: 2, color: colors.primary[400] },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.md },
  statBox: { width: '47%', gap: 2 },
  statLabel: { fontSize: typography.fontSizes.xs },
  statValue: { fontSize: typography.fontSizes.md, fontWeight: typography.fontWeights.bold },
  goalsSection: { gap: 6, marginBottom: spacing.md },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  goalText: { fontSize: typography.fontSizes.xs, fontWeight: '600' },
  causesSection: { marginTop: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, gap: 6 },
  causesHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  causesTitle: { fontSize: typography.fontSizes.sm, fontWeight: '700' },
  causeText: { fontSize: typography.fontSizes.xs, lineHeight: 18 },
});