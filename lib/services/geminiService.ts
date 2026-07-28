// geminiService.ts
// Google Gemini API integration for AI-driven financial insights.
// Replaces/supplements the OpenRouter call in your existing AI insights service.
//
// Add to .env:
//   EXPO_PUBLIC_GEMINI_API_KEY=your-key-from-aistudio.google.com
//
// Docs: https://ai.google.dev/api/rest

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

interface FinancialSnapshot {
  monthlyIncome: number;
  monthlyExpenses: number;
  topCategories: { category: string; amount: number }[];
  savingsRate: number;
  totalDebtEMI: number;
}

export interface AIInsight {
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

/**
 * Sends a structured financial snapshot to Gemini and asks for JSON-formatted
 * insights. Falls back to rule-based insights on failure (keeps the app's
 * existing "works without API key" guarantee).
 */
export async function getAIInsights(snapshot: FinancialSnapshot): Promise<AIInsight[]> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    return ruleBasedFallback(snapshot);
  }

  const prompt = `You are a personal finance advisor. Given this monthly snapshot:
Income: ${snapshot.monthlyIncome}
Expenses: ${snapshot.monthlyExpenses}
Savings rate: ${(snapshot.savingsRate * 100).toFixed(1)}%
Total monthly debt/EMI payments: ${snapshot.totalDebtEMI}
Top spending categories: ${snapshot.topCategories.map((c) => `${c.category}: ${c.amount}`).join(', ')}

Return ONLY a JSON array (no markdown, no prose) of 3 insight objects, each with:
"title" (short), "message" (1-2 sentences, actionable), "severity" ("info" | "warning" | "critical").`;

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);

    const data = await response.json();
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned) as AIInsight[];
    return parsed;
  } catch (error) {
    console.warn('Gemini insight generation failed, using fallback:', error);
    return ruleBasedFallback(snapshot);
  }
}

/** Rule-based fallback so the app still functions without an API key. */
function ruleBasedFallback(snapshot: FinancialSnapshot): AIInsight[] {
  const insights: AIInsight[] = [];

  if (snapshot.savingsRate < 0.1) {
    insights.push({
      title: 'Low Savings Rate',
      message: `You're saving only ${(snapshot.savingsRate * 100).toFixed(
        1
      )}% of your income. Aim for at least 20% under the 50/30/20 rule.`,
      severity: 'warning',
    });
  }

  if (snapshot.totalDebtEMI / Math.max(snapshot.monthlyIncome, 1) > 0.4) {
    insights.push({
      title: 'High Debt Load',
      message:
        'Your monthly EMI obligations exceed 40% of income, which increases financial risk.',
      severity: 'critical',
    });
  }

  const topCategory = snapshot.topCategories[0];
  if (topCategory) {
    insights.push({
      title: `${topCategory.category} is your top expense`,
      message: `You spent ${topCategory.amount} on ${topCategory.category} this month. Review this category for savings opportunities.`,
      severity: 'info',
    });
  }

  return insights;
}
