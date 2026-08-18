// lib/services/achievements.ts
import { getDreamPlans } from './dreamPlans';
import { DreamCategory } from '@/lib/types';

export interface Achievement {
  dreamId: string;
  title: string;
  category: DreamCategory;
  emoji: string;
  label: string;
  completedAt: string;
}

const CATEGORY_META: Record<DreamCategory, { emoji: string; label: string }> = {
  wedding: { emoji: '💍', label: 'Wedding' },
  car: { emoji: '🚗', label: 'Car' },
  home: { emoji: '🏠', label: 'Home' },
  degree: { emoji: '🎓', label: 'Degree' },
  career_milestone: { emoji: '💼', label: 'Career Milestone' },
  travel: { emoji: '✈️', label: 'Travel' },
  wealth_goal: { emoji: '💰', label: 'Wealth Goal' },
  other: { emoji: '⭐', label: 'Goal' },
};

export async function getAchievements(userId: string): Promise<Achievement[]> {
  const allDreams = await getDreamPlans(userId);
  const completed = allDreams.filter((d) => d.status === 'completed');

  return completed
    .map((d) => {
      const meta = CATEGORY_META[d.category] ?? CATEGORY_META.other;
      return {
        dreamId: d.id,
        title: d.title,
        category: d.category,
        emoji: meta.emoji,
        label: meta.label,
        completedAt: d.completedAt ?? d.updatedAt,
      };
    })
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
}

export interface MilestoneBadge {
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  label: string;
  requiredCount: number;
  unlocked: boolean;
}

export function getMilestoneBadges(completedCount: number): MilestoneBadge[] {
  const tiers: MilestoneBadge[] = [
    { tier: 'bronze', label: 'First Goal', requiredCount: 1, unlocked: completedCount >= 1 },
    { tier: 'silver', label: '3 Goals Achieved', requiredCount: 3, unlocked: completedCount >= 3 },
    { tier: 'gold', label: '5 Goals Achieved', requiredCount: 5, unlocked: completedCount >= 5 },
    { tier: 'platinum', label: '10 Goals Achieved', requiredCount: 10, unlocked: completedCount >= 10 },
  ];
  return tiers;
}