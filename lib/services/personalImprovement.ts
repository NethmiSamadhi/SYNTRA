// lib/services/personalImprovement.ts
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Achievement, MilestoneBadge } from './achievements';
import { DreamProgress } from './dreamProgress';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemma-2-9b-it:free';
const REFERER = process.env.EXPO_PUBLIC_APP_URL || 'https://syntra.app';
const APP_TITLE = 'SYNTRA';

export interface ImprovementSuggestion {
  id: string;
  title: string;
  description: string;
  type: 'encouragement' | 'tip' | 'warning' | 'celebration';
  priority: 'high' | 'medium' | 'low';
}

async function getAIConfig(): Promise<{ apiKey: string | null; model: string; provider: string; apiUrl: string }> {
  let apiKey: string | null = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY || null;
  let model = DEFAULT_MODEL;
  let provider = 'openrouter';

  try {
    const stored = Platform.OS === 'web'
      ? localStorage.getItem('budget_buddy_user_profile')
      : await SecureStore.getItemAsync('budget_buddy_user_profile');

    if (stored) {
      const user = JSON.parse(stored);
      if (user.aiConfig?.apiKey) {
        apiKey = user.aiConfig.apiKey;
        model = user.aiConfig.model || model;
        provider = user.aiConfig.provider || provider;
      }
    }
  } catch (err) {
    console.warn('Error loading AI config for personal improvement:', err);
  }

  const apiUrl = provider === 'openai' ? OPENAI_API_URL : OPENROUTER_API_URL;
  return { apiKey, model, provider, apiUrl };
}

/**
 * Rule-based suggestions — always available, zero dependency on network/API.
 */
export function computeRuleBasedSuggestions(
  achievements: Achievement[],
  milestoneBadges: MilestoneBadge[],
  progressList: DreamProgress[]
): ImprovementSuggestion[] {
  const suggestions: ImprovementSuggestion[] = [];
  const completedCount = achievements.length;

  const nextBadge = milestoneBadges.find((b) => !b.unlocked);
  if (nextBadge) {
    const remaining = nextBadge.requiredCount - completedCount;
    if (remaining === 1) {
      suggestions.push({
        id: 'next-badge-close',
        title: `One goal away from ${nextBadge.tier.toUpperCase()}!`,
        description: `Complete just one more dream to unlock the "${nextBadge.label}" badge. You're almost there.`,
        type: 'encouragement',
        priority: 'high',
      });
    } else if (remaining <= 3) {
      suggestions.push({
        id: 'next-badge-progress',
        title: `${remaining} goals to your next milestone`,
        description: `Complete ${remaining} more dreams to reach the "${nextBadge.label}" badge.`,
        type: 'tip',
        priority: 'medium',
      });
    }
  }

  if (completedCount === 0) {
    suggestions.push({
      id: 'first-goal',
      title: 'Complete your first dream',
      description: 'Every journey starts with a single achieved goal. Focus on your smallest active dream to build momentum.',
      type: 'tip',
      priority: 'high',
    });
  }

  const activeDreams = progressList.filter((p) => p.progressPct < 100);

  const almostThere = activeDreams.filter((p) => p.progressPct >= 90);
  almostThere.forEach((p) => {
    suggestions.push({
      id: 'almost-there-' + p.dream.id,
      title: `"${p.dream.title}" is almost complete!`,
      description: `You're at ${p.progressPct}% — just a final push to reach this goal.`,
      type: 'celebration',
      priority: 'high',
    });
  });

  const stalled = activeDreams.filter((p) => p.progressPct < 10 && p.totalSaved === 0);
  stalled.forEach((p) => {
    suggestions.push({
      id: 'stalled-' + p.dream.id,
      title: `Start contributing to "${p.dream.title}"`,
      description: `This goal hasn't received any savings yet. Even a small monthly contribution builds momentum.`,
      type: 'warning',
      priority: 'medium',
    });
  });

  const longHorizon = activeDreams.filter((p) => p.monthsRemaining != null && p.monthsRemaining > 24);
  longHorizon.forEach((p) => {
    suggestions.push({
      id: 'long-horizon-' + p.dream.id,
      title: `"${p.dream.title}" is a long-term goal`,
      description: `At your current pace, this will take over 2 years. Consider increasing your monthly contribution to reach it sooner.`,
      type: 'tip',
      priority: 'low',
    });
  });

  if (suggestions.length === 0) {
    suggestions.push({
      id: 'all-good',
      title: "You're on track",
      description: 'All your active dreams are progressing well. Keep up the consistent saving habit.',
      type: 'celebration',
      priority: 'low',
    });
  }

  const priorityOrder = { high: 3, medium: 2, low: 1 };
  return suggestions
    .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
    .slice(0, 4);
}

/**
 * AI-enhanced suggestions layered on top of the rule-based engine.
 * Falls back to rule-based output on any failure.
 */
export async function getPersonalImprovementSuggestions(
  achievements: Achievement[],
  milestoneBadges: MilestoneBadge[],
  progressList: DreamProgress[]
): Promise<ImprovementSuggestion[]> {
  const fallback = computeRuleBasedSuggestions(achievements, milestoneBadges, progressList);
  const { apiKey, model, apiUrl, provider } = await getAIConfig();

  if (!apiKey) return fallback;
  if (provider === 'openrouter' && !apiKey.startsWith('sk-or-v1-')) return fallback;

  const summary = {
    completedGoals: achievements.length,
    unlockedBadges: milestoneBadges.filter((b) => b.unlocked).map((b) => b.label),
    activeDreams: progressList.map((p) => ({
      title: p.dream.title,
      category: p.dream.category,
      progressPct: p.progressPct,
      monthsRemaining: p.monthsRemaining,
    })),
  };

  const userPrompt = `You are a personal growth coach inside a finance app called SYNTRA. Analyze this user's goal-completion data and return up to 3 short, encouraging, actionable suggestions for personal improvement.

Format: {"suggestions": [{"title": "", "description": "", "type": "encouragement|tip|warning|celebration", "priority": "high|medium|low"}]}

Return ONLY valid JSON, no markdown code blocks.

Data:
${JSON.stringify(summary, null, 2)}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': REFERER,
        'X-Title': APP_TITLE,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) return fallback;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return fallback;

    let jsonContent = content.trim();
    const jsonMatch = jsonContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) jsonContent = jsonMatch[1];

    const parsed = JSON.parse(jsonContent) as { suggestions?: Partial<ImprovementSuggestion>[] };
    const aiSuggestions = (parsed.suggestions ?? []).map((s, index) => ({
      id: `ai-${index}`,
      title: s.title ?? 'Suggestion',
      description: s.description ?? '',
      type: (s.type as ImprovementSuggestion['type']) ?? 'tip',
      priority: (s.priority as ImprovementSuggestion['priority']) ?? 'medium',
    }));

    return aiSuggestions.length > 0 ? aiSuggestions : fallback;
  } catch (error) {
    console.error('Error fetching AI improvement suggestions:', error);
    return fallback;
  }
}