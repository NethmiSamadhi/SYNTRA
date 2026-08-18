// components/GoalCollisionCard.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import { colors, borderRadius, typography, spacing } from '@/lib/theme';
import { detectGoalCollision, GoalCollisionResult } from '@/lib/services/goalCollision';
import { formatCurrency } from '@/lib/types';
import { useUser } from '@/lib/UserContext';

interface GoalCollisionCardProps {
  userId: string;
}

export function GoalCollisionCard({ userId }: GoalCollisionCardProps) {
  const { user } = useUser();
  const displayCurrency = (amount: number) => formatCurrency(amount, user?.currency);
  const [result, setResult] = useState<GoalCollisionResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [userId]);

  const load = async () => {
    try {
      setLoading(true);
      const r = await detectGoalCollision(userId);
      setResult(r);
    } catch (e) {
      console.error('Error detecting goal collision:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.card, styles.loadingCard]}>
        <ActivityIndicator color={colors.primary[400]} />
      </View>
    );
  }

  // Nothing to show if there are no dated goals at all
  if (!result || result.goalsWithDeadline.length === 0) return null;

  const isCollision = result.hasCollision;

  return (
    <Animated.View
      entering={FadeInDown.duration(500)}
      style={[
        styles.card,
        isCollision ? styles.collisionCard : styles.safeCard,
      ]}
    >
      <View style={styles.header}>
        {isCollision ? (
          <AlertTriangle size={20} color={colors.warning} />
        ) : (
          <CheckCircle2 size={20} color={colors.success} />
        )}
        <Text style={styles.headerTitle}>
          {isCollision ? 'Goal Collision Detected' : 'Your Goals Fit Your Budget'}
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>You're trying to save</Text>
          <Text style={[styles.statValue, isCollision && { color: colors.warning }]}>
            {displayCurrency(result.totalRequiredAnnual)}/yr
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Projected surplus</Text>
          <Text style={styles.statValue}>{displayCurrency(result.projectedAnnualSurplus)}/yr</Text>
        </View>
      </View>

      {isCollision && result.suggestion && (
        <View style={styles.suggestionBox}>
          <Text style={styles.suggestionLabel}>Suggested fix</Text>
          <Text style={styles.suggestionText}>{result.suggestion.message}</Text>
        </View>
      )}

      {result.goalsWithoutDeadline.length > 0 && (
        <Text style={styles.flexibleNote}>
          {result.goalsWithoutDeadline.length} goal
          {result.goalsWithoutDeadline.length === 1 ? '' : 's'} without a target date{' '}
          {result.goalsWithoutDeadline.length === 1 ? "isn't" : "aren't"} included above — set a date to factor {result.goalsWithoutDeadline.length === 1 ? 'it' : 'them'} in.
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
  },
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
    minHeight: 80,
  },
  collisionCard: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderColor: 'rgba(245,158,11,0.3)',
  },
  safeCard: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderColor: 'rgba(34,197,94,0.25)',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  headerTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  statItem: { flex: 1 },
  statLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  statValue: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 2 },
  suggestionBox: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  suggestionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  suggestionText: { color: '#fff', fontSize: 13, lineHeight: 18 },
  flexibleNote: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
});