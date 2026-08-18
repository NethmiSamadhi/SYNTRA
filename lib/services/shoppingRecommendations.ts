// lib/services/shoppingRecommendations.ts
import { searchNearbyPlaces, budgetToPriceLevel, PlaceResult } from './placesService';
import { getCurrentMonthlyPlan } from './monthlyPlans';
import { getTransactions } from './transactions';
import { UserLocation } from '@/lib/hooks/useLocation';

export interface ShoppingRecommendation {
  category: string;
  remainingBudget: number;
  places: PlaceResult[];
}

const CATEGORY_TO_PLACE_TYPE: Record<string, string> = {
  Shopping: 'shopping_mall',
  Food: 'restaurant',
  Groceries: 'supermarket',
  Electronics: 'electronics_store',
  Clothing: 'clothing_store',
};

function looselyMatches(fullString: string, plainCategory: string): boolean {
  return fullString.toLowerCase().indexOf(plainCategory.toLowerCase()) !== -1;
}

function findBudgetedAmount(plan: any, plainCategory: string): number {
  const essentials = plan.essentials || {};
  const essentialsKeys = Object.keys(essentials);
  for (let i = 0; i < essentialsKeys.length; i++) {
    if (looselyMatches(essentialsKeys[i], plainCategory)) {
      return essentials[essentialsKeys[i]];
    }
  }

  const allocations = plan.allocations || {};
  const allocationKeys = Object.keys(allocations);
  for (let i = 0; i < allocationKeys.length; i++) {
    if (looselyMatches(allocationKeys[i], plainCategory)) {
      return allocations[allocationKeys[i]];
    }
  }

  return 0;
}

export async function getShoppingRecommendations(
  category: string,
  location: UserLocation,
  productQuery?: string
): Promise<ShoppingRecommendation | null> {
  const plan = await getCurrentMonthlyPlan();

  let remainingBudget = 0;

  if (plan) {
    const now = new Date();
    const transactions = await getTransactions({});

    let spentThisCategory = 0;
    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      const d = new Date(t.date);
      if (
        t.type === 'expense' &&
        looselyMatches(t.category, category) &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      ) {
        spentThisCategory = spentThisCategory + t.amount;
      }
    }

    const budgeted = findBudgetedAmount(plan, category);
    remainingBudget = Math.max(budgeted - spentThisCategory, 0);
  }

  const placeType = CATEGORY_TO_PLACE_TYPE[category] || 'store';

  const places = await searchNearbyPlaces({
    latitude: location.latitude,
    longitude: location.longitude,
    type: placeType,
    keyword: productQuery,
  });

  return { category: category, remainingBudget: remainingBudget, places: places.slice(0, 15) };
}