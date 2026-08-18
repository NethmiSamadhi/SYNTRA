import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Star, Sparkles, TrendingUp, Flame, Trophy, Award, LineChart, Plus, Trash2, X, Lightbulb } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { colors, borderRadius, typography, spacing } from '@/lib/theme';
import { useTheme } from '@/lib/ThemeContext';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { saveDreamPlan, deleteDreamPlan } from '@/lib/services/dreamPlans';
import { calculateAllDreamProgress, DreamProgress } from '@/lib/services/dreamProgress';
import { getDreamStreak, getDreamOfTheMonth, DreamOfTheMonth } from '@/lib/services/dreamGamification';
import { getAchievements, getMilestoneBadges, Achievement, MilestoneBadge } from '@/lib/services/achievements';
import { getYearlyProjection, YearlyProjection } from '@/lib/services/yearlyProjection';
import { getPersonalImprovementSuggestions, ImprovementSuggestion } from '@/lib/services/personalImprovement';
import { useUser } from '@/lib/UserContext';
import { formatCurrency } from '@/lib/types';
import { DreamCategory } from '@/lib/types';
import { DreamClimbPath } from '@/components/DreamClimbPath';
import { GoalCollisionCard } from '@/components/GoalCollisionCard';

const TEST_USER_ID = 'test-user-1';

const CATEGORY_META: Record<string, { emoji: string; label: string }> = {
  wedding: { emoji: '💍', label: 'Wedding' },
  car: { emoji: '🚗', label: 'Car' },
  home: { emoji: '🏠', label: 'Home' },
  degree: { emoji: '🎓', label: 'Degree' },
  career_milestone: { emoji: '💼', label: 'Career' },
  travel: { emoji: '✈️', label: 'Travel' },
  wealth_goal: { emoji: '💰', label: 'Wealth Goal' },
  other: { emoji: '⭐', label: 'Dream' },
};

const CATEGORY_OPTIONS: DreamCategory[] = ['wedding', 'car', 'home', 'degree', 'career_milestone', 'travel', 'wealth_goal', 'other'];

const TIER_COLORS: Record<string, string> = {
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#ffd700',
  platinum: '#e5e4e2',
};

const STAR_POSITIONS = Array.from({ length: 40 }).map((_, i) => ({
  top: `${(i * 37) % 100}%`,
  left: `${(i * 53) % 100}%`,
  size: (i % 3) + 1,
  opacity: 0.2 + (i % 5) * 0.15,
}));

export default function DreamTestScreen() {
  const { user } = useUser();
  const [progressList, setProgressList] = useState<DreamProgress[]>([]);
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [spotlight, setSpotlight] = useState<DreamOfTheMonth | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [milestoneBadges, setMilestoneBadges] = useState<MilestoneBadge[]>([]);
  const [projection, setProjection] = useState<YearlyProjection | null>(null);
  const [suggestions, setSuggestions] = useState<ImprovementSuggestion[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<DreamCategory>('other');
  const [newTargetCost, setNewTargetCost] = useState('');
  const [saving, setSaving] = useState(false);

  const displayCurrency = (amount: number) => formatCurrency(amount, user?.currency);

  useEffect(() => {
    loadProgress();
  }, []);

  async function loadProgress() {
    try {
      const results = await calculateAllDreamProgress(TEST_USER_ID, 1000);
      setProgressList(results);

      // Detect dreams that just crossed 100% and persist them as completed,
      // so they show up in Achievements.
      const justCompleted = results.filter(
        (p) => p.progressPct >= 100 && p.dream.status !== 'completed'
      );
      if (justCompleted.length > 0) {
        await Promise.all(
          justCompleted.map((p) =>
            saveDreamPlan({
              ...p.dream,
              status: 'completed',
              completedAt: new Date().toISOString(),
            })
          )
        );
      }

      const spotlightResult = await getDreamOfTheMonth(TEST_USER_ID, 1000);
      setSpotlight(spotlightResult);

      const streakEntries = await Promise.all(
        results.map(async (p) => {
          const s = await getDreamStreak(p.dream.id);
          return [p.dream.id, s.currentStreakMonths] as const;
        })
      );
      setStreaks(Object.fromEntries(streakEntries));

      const achievementsList = await getAchievements(TEST_USER_ID);
      setAchievements(achievementsList);
      setMilestoneBadges(getMilestoneBadges(achievementsList.length));

      const improvementSuggestions = await getPersonalImprovementSuggestions(
        achievementsList,
        getMilestoneBadges(achievementsList.length),
        results
      );
      setSuggestions(improvementSuggestions);

      const yearlyProjection = await getYearlyProjection();
      setProjection(yearlyProjection);
    } catch (e) {
      console.warn('Error loading dream data:', e);
    } finally {
      setInitialLoad(false);
    }
  }

  async function handleCreateDream() {
    if (!newTitle.trim() || !newTargetCost) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await saveDreamPlan({
        id: Crypto.randomUUID(),
        userId: TEST_USER_ID,
        title: newTitle.trim(),
        category: newCategory,
        targetCost: parseFloat(newTargetCost) || 0,
        annualCostGrowthRate: 0.04,
        targetDownPaymentPct: newCategory === 'car' || newCategory === 'home' ? 0.2 : undefined,
        priorityWeight: 3,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setNewTitle('');
      setNewTargetCost('');
      setNewCategory('other');
      setShowAddModal(false);
      await loadProgress();
    } catch (e) {
      Alert.alert('Error', 'Failed to create dream.');
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteDream(dreamId: string, title: string) {
    Alert.alert('Delete Dream', `Remove "${title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDreamPlan(dreamId);
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          await loadProgress();
        },
      },
    ]);
  }

  // TEMP TEST HANDLER — marks a dream complete instantly for testing the
  // Achievements card. Remove this once verified.
  async function handleTestComplete(dreamId: string) {
    const target = progressList.find((p) => p.dream.id === dreamId);
    if (!target) return;
    await saveDreamPlan({
      ...target.dream,
      status: 'completed',
      completedAt: new Date().toISOString(),
    });
    await loadProgress();
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.starLayer} pointerEvents="none">
        {STAR_POSITIONS.map((s, i) => (
          <View
            key={i}
            style={[
              styles.star,
              { top: s.top as any, left: s.left as any, width: s.size, height: s.size, opacity: s.opacity },
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(500)} style={styles.header}>
          <Sparkles size={28} color={colors.primary[400]} />
          <Text style={styles.headerTitle}>Dream Planning</Text>
          <Text style={styles.headerSubtitle}>Every goal is a star waiting to shine ✨</Text>
        </Animated.View>

        {!initialLoad && (
          <Animated.View entering={FadeInDown.delay(80)}>
            <GoalCollisionCard userId={TEST_USER_ID} />
          </Animated.View>
        )}

        {spotlight && (
          <Animated.View entering={FadeInDown.delay(100)} style={styles.spotlightCard}>
            <Trophy size={20} color={colors.warning} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={styles.spotlightLabel}>Dream of the Month</Text>
              <Text style={styles.spotlightTitle}>
                {spotlight.progress.dream.title} — {displayCurrency(spotlight.thisMonthContributed)} saved this month
              </Text>
            </View>
          </Animated.View>
        )}

        {projection && (
          <Animated.View entering={FadeInDown.delay(130)} style={styles.projectionCard}>
            <View style={styles.projectionHeader}>
              <LineChart size={20} color={colors.primary[400]} />
              <Text style={styles.projectionTitle}>Your Next Year, Projected</Text>
            </View>
            <Text style={styles.projectionSubtitle}>Based on your last 3 months of activity — an estimate, not a guarantee</Text>

            <View style={styles.projectionStatsRow}>
              <View style={styles.projectionStat}>
                <Text style={styles.projectionStatLabel}>Net Worth Now</Text>
                <Text style={styles.projectionStatValue}>{displayCurrency(projection.currentNetWorth)}</Text>
              </View>
              <View style={styles.projectionStat}>
                <Text style={styles.projectionStatLabel}>In 12 Months</Text>
                <Text style={[styles.projectionStatValue, { color: colors.primary[400] }]}>
                  {displayCurrency(projection.projectedNetWorthNextYear)}
                </Text>
              </View>
            </View>

            {projection.netWorthGrowthPct !== null && (
              <View style={styles.growthBadge}>
                <TrendingUp size={14} color={projection.netWorthGrowthPct >= 0 ? colors.success : colors.error} />
                <Text
                  style={[
                    styles.growthText,
                    { color: projection.netWorthGrowthPct >= 0 ? colors.success : colors.error },
                  ]}
                >
                  {projection.netWorthGrowthPct >= 0 ? '+' : ''}
                  {projection.netWorthGrowthPct}% projected growth
                </Text>
              </View>
            )}

            <View style={styles.trendRow}>
              <Text style={styles.trendLabel}>Savings Trend: </Text>
              <Text style={[styles.trendValue, { color: colors.primary[400] }]}>{projection.trendLabel}</Text>
            </View>
            <Text style={styles.trendDetail}>
              Saving ~{displayCurrency(projection.avgMonthlySavings)}/month ({projection.savingsRatePct}% of income)
            </Text>
          </Animated.View>
        )}

        {(achievements.length > 0 || milestoneBadges.some((b) => b.unlocked)) && (
          <Animated.View entering={FadeInDown.delay(160)} style={styles.achievementsSection}>
            <View style={styles.achievementsHeader}>
              <Award size={20} color={colors.warning} />
              <Text style={styles.achievementsTitle}>Achievements</Text>
            </View>

            {milestoneBadges.filter((b) => b.unlocked).length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
                {milestoneBadges
                  .filter((b) => b.unlocked)
                  .map((badge) => (
                    <View key={badge.tier} style={[styles.milestoneBadge, { borderColor: TIER_COLORS[badge.tier] }]}>
                      <Trophy size={16} color={TIER_COLORS[badge.tier]} />
                      <Text style={[styles.milestoneBadgeText, { color: TIER_COLORS[badge.tier] }]}>{badge.label}</Text>
                    </View>
                  ))}
              </ScrollView>
            )}

            {achievements.map((a) => (
              <View key={a.dreamId} style={styles.achievementRow}>
                <Text style={styles.achievementEmoji}>{a.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.achievementTitle}>{a.title}</Text>
                  <Text style={styles.achievementDate}>Completed {new Date(a.completedAt).toLocaleDateString()}</Text>
                </View>
              </View>
            ))}
          </Animated.View>
        )}

        {suggestions.length > 0 && (
          <Animated.View entering={FadeInDown.delay(175)} style={styles.suggestionsSection}>
            <View style={styles.achievementsHeader}>
              <Lightbulb size={20} color={colors.primary[400]} />
              <Text style={styles.achievementsTitle}>Personal Growth</Text>
            </View>
            {suggestions.map((s) => (
              <View key={s.id} style={styles.suggestionCard}>
                <Text style={styles.suggestionTitle}>{s.title}</Text>
                <Text style={styles.suggestionDescription}>{s.description}</Text>
              </View>
            ))}
          </Animated.View>
        )}

        {initialLoad ? (
          <ActivityIndicator color={colors.primary[400]} style={{ marginTop: spacing['3xl'] }} />
        ) : progressList.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(190)} style={styles.emptyState}>
            <Star size={40} color={colors.primary[400]} />
            <Text style={styles.emptyText}>No dreams yet — add one to see it come alive.</Text>
          </Animated.View>
        ) : (
          progressList.map((p, index) => (
            <Animated.View key={p.dream.id} entering={FadeInDown.delay(190 + index * 100).springify()}>
              <DreamStarCard
                progress={p}
                streakMonths={streaks[p.dream.id] ?? 0}
                onDelete={() => handleDeleteDream(p.dream.id, p.dream.title)}
                onTestComplete={() => handleTestComplete(p.dream.id)}
                displayCurrency={displayCurrency}
              />
            </Animated.View>
          ))
        )}

        <View style={{ marginTop: spacing.xl, paddingHorizontal: spacing.xl }}>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
            <Plus size={20} color="#fff" />
            <Text style={styles.addButtonText}>Add New Dream</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {showAddModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Dream</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Title</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Wedding in 2027"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <Text style={styles.modalLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              {CATEGORY_OPTIONS.map((cat) => {
                const meta = CATEGORY_META[cat];
                const isSelected = newCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setNewCategory(cat)}
                    style={[
                      styles.categoryChip,
                      { backgroundColor: isSelected ? colors.primary[500] : 'rgba(255,255,255,0.08)' },
                    ]}
                  >
                    <Text style={{ fontSize: 16 }}>{meta.emoji}</Text>
                    <Text style={{ color: isSelected ? '#fff' : 'rgba(255,255,255,0.8)', fontSize: 12, marginLeft: 4 }}>
                      {meta.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.modalLabel}>Target Amount</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="0"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={newTargetCost}
              onChangeText={setNewTargetCost}
              keyboardType="numeric"
            />

            <TouchableOpacity
              style={[styles.modalSubmit, { opacity: !newTitle.trim() || !newTargetCost || saving ? 0.5 : 1 }]}
              onPress={handleCreateDream}
              disabled={!newTitle.trim() || !newTargetCost || saving}
            >
              <Text style={styles.modalSubmitText}>{saving ? 'Saving...' : 'Create Dream'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function DreamStarCard({
  progress,
  streakMonths,
  onDelete,
  onTestComplete,
  displayCurrency,
}: {
  progress: DreamProgress;
  streakMonths: number;
  onDelete: () => void;
  onTestComplete: () => void;
  displayCurrency: (amount: number) => string;
}) {
  const meta = CATEGORY_META[progress.dream.category] ?? CATEGORY_META.other;
  const brightness = 0.35 + (progress.progressPct / 100) * 0.65;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.starIconWrap, { opacity: brightness }]}>
          <Star size={22} color={colors.warning} fill={colors.warning} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{meta.emoji} {progress.dream.title}</Text>
          <Text style={styles.cardCategory}>{meta.label}</Text>
        </View>
        {streakMonths > 0 && (
          <View style={styles.streakBadge}>
            <Flame size={12} color={colors.warning} />
            <Text style={styles.streakText}>{streakMonths}mo</Text>
          </View>
        )}
        <Text style={styles.cardPct}>{progress.progressPct}%</Text>
        <TouchableOpacity onPress={onDelete} style={{ marginLeft: spacing.sm, padding: 4 }}>
          <Trash2 size={16} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
        {/* TEMP TEST BUTTON — instantly marks this dream complete so you can
            verify the Achievements card renders. Remove after testing. */}
        <TouchableOpacity onPress={onTestComplete} style={{ marginLeft: spacing.xs, padding: 4 }}>
          <Trophy size={16} color={colors.warning} />
        </TouchableOpacity>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress.progressPct}%` }]} />
      </View>

      <View style={styles.climbRow}>
        <DreamClimbPath progressPct={progress.progressPct} categoryEmoji={meta.emoji} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <MilestoneMessage progressPct={progress.progressPct} title={progress.dream.title} />
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <TrendingUp size={14} color={colors.success} />
            <Text style={styles.statLabel}>Saved</Text>
          </View>
          <Text style={styles.statValue}>{displayCurrency(progress.totalSaved)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Remaining</Text>
          <Text style={styles.statValue}>{displayCurrency(progress.amountRemaining)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>ETA</Text>
          <Text style={styles.statValue}>
            {progress.monthsRemaining != null ? `${progress.monthsRemaining}mo` : '—'}
          </Text>
        </View>
      </View>
    </View>
  );
}
function MilestoneMessage({ progressPct, title }: { progressPct: number; title: string }) {
  let message = '';
  let subMessage = '';

  if (progressPct >= 100) {
    message = '🎉 Summit reached!';
    subMessage = `You did it — "${title}" is achieved!`;
  } else if (progressPct >= 75) {
    message = '🔥 Almost there';
    subMessage = 'Final push — you can see the top from here.';
  } else if (progressPct >= 50) {
    message = '⛰️ Halfway up';
    subMessage = 'Great pace — keep climbing.';
  } else if (progressPct >= 25) {
    message = '🥾 Making progress';
    subMessage = 'The climb has begun.';
  } else {
    message = '🏕️ Base camp';
    subMessage = 'Every journey starts with a first step.';
  }

  return (
    <View>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{message}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>{subMessage}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate[950] },
  starLayer: { ...StyleSheet.absoluteFillObject },
  star: { position: 'absolute', borderRadius: 10, backgroundColor: '#ffffff' },
  scrollContent: { paddingBottom: spacing['3xl'] },
  header: { alignItems: 'center', paddingTop: spacing.xl, paddingBottom: spacing.lg, paddingHorizontal: spacing.xl },
  headerTitle: { fontSize: typography.fontSizes['2xl'], fontWeight: typography.fontWeights.bold, color: '#ffffff', marginTop: spacing.sm },
  headerSubtitle: { fontSize: typography.fontSizes.sm, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  spotlightCard: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.xl, marginBottom: spacing.md,
    padding: spacing.md, borderRadius: borderRadius.xl, backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
  },
  spotlightLabel: { fontSize: typography.fontSizes.xs, color: 'rgba(255,255,255,0.6)', fontWeight: typography.fontWeights.semibold },
  spotlightTitle: { fontSize: typography.fontSizes.sm, color: '#ffffff', marginTop: 2 },
  projectionCard: {
    marginHorizontal: spacing.xl, marginBottom: spacing.md, padding: spacing.lg, borderRadius: borderRadius.xl,
    backgroundColor: 'rgba(99,102,241,0.1)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.25)',
  },
  projectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  projectionTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  projectionSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2, marginBottom: spacing.md },
  projectionStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  projectionStat: { flex: 1 },
  projectionStatLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  projectionStatValue: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 2 },
  growthBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm },
  growthText: { fontSize: 12, fontWeight: '700' },
  trendRow: { flexDirection: 'row', marginTop: 4 },
  trendLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  trendValue: { fontSize: 12, fontWeight: '700' },
  trendDetail: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 },
  achievementsSection: {
    marginHorizontal: spacing.xl, marginBottom: spacing.md, padding: spacing.lg, borderRadius: borderRadius.xl,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  achievementsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  achievementsTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  milestoneBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: borderRadius.full, paddingHorizontal: 12, paddingVertical: 6, marginRight: spacing.sm },
  milestoneBadgeText: { fontSize: 11, fontWeight: '700' },
  achievementRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  achievementEmoji: { fontSize: 24, marginRight: spacing.sm },
  achievementTitle: { color: '#fff', fontWeight: '600', fontSize: 13 },
  achievementDate: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 },
  suggestionsSection: {
    marginHorizontal: spacing.xl, marginBottom: spacing.md, padding: spacing.lg, borderRadius: borderRadius.xl,
    backgroundColor: 'rgba(99,102,241,0.08)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)',
  },
  suggestionCard: { marginTop: spacing.sm, paddingVertical: spacing.xs },
  suggestionTitle: { color: '#fff', fontWeight: '700', fontSize: 13 },
  suggestionDescription: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingVertical: spacing['3xl'], gap: spacing.md },
  emptyText: { color: 'rgba(255,255,255,0.6)', fontSize: typography.fontSizes.sm, textAlign: 'center', paddingHorizontal: spacing.xl },
  card: {
    marginHorizontal: spacing.xl, marginTop: spacing.md, padding: spacing.lg, borderRadius: borderRadius['2xl'],
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  starIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(251,191,36,0.15)', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: typography.fontSizes.md, fontWeight: typography.fontWeights.bold, color: '#ffffff' },
  cardCategory: { fontSize: typography.fontSizes.xs, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  cardPct: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.bold, color: colors.primary[400] },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(251,191,36,0.15)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: borderRadius.full, marginRight: spacing.xs },
  streakText: { fontSize: 10, fontWeight: typography.fontWeights.bold, color: colors.warning },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', marginTop: spacing.md, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary[400], borderRadius: 3 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  statItem: { alignItems: 'flex-start', gap: 2 },
  statLabel: { fontSize: typography.fontSizes.xs, color: 'rgba(255,255,255,0.5)' },
  statValue: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.semibold, color: '#ffffff' },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary[500], paddingVertical: spacing.md, borderRadius: borderRadius.lg, gap: 8 },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.slate[900], borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, paddingBottom: spacing['3xl'] },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  modalInput: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: borderRadius.lg, padding: spacing.md, color: '#fff', marginBottom: spacing.md, fontSize: 14 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: borderRadius.full, marginRight: spacing.sm },
  modalSubmit: { backgroundColor: colors.primary[500], paddingVertical: spacing.md, borderRadius: borderRadius.lg, alignItems: 'center', marginTop: spacing.sm },
  modalSubmitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});