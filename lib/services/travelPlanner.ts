// lib/services/travelPlanner.ts
import { searchNearbyPlaces, PlaceResult } from './placesService';
import { getAccounts } from './accounts';
import { getWeatherForecast, DailyForecast } from './weather';

export interface GeocodedPlace {
  name: string;
  lat: number;
  lng: number;
}

export interface TripStyle {
  id: 'budget' | 'midrange' | 'luxury';
  label: string;
  dailyCost: number;
}

export const TRIP_STYLES: TripStyle[] = [
  { id: 'budget', label: 'Budget', dailyCost: 3000 },
  { id: 'midrange', label: 'Mid-range', dailyCost: 7000 },
  { id: 'luxury', label: 'Luxury', dailyCost: 15000 },
];

export type RiskLevel = 'safe' | 'tight' | 'risky';

export interface TripPlan {
  destination: string;
  lat: number;
  lng: number;
  totalBudget: number;
  dailyCostEstimate: number;
  affordableDays: number;
  selectedDays: number;
  estimatedTripCost: number;
  remainingAfterTrip: number;
  riskLevel: RiskLevel;
  riskMessage: string;
  accommodationBudget: number;
  foodBudget: number;
  activitiesBudget: number;
  hotels: PlaceResult[];
  restaurants: PlaceResult[];
  attractions: PlaceResult[];
  weather: DailyForecast[];
  readinessScore: number;
  readinessLabel: string;
}

export async function getSuggestedBudget(): Promise<number> {
  try {
    const accounts = await getAccounts();
    return accounts.reduce((sum: number, a: any) => sum + (a.balance || 0), 0);
  } catch {
    return 0;
  }
}

export async function geocodeDestination(query: string): Promise<GeocodedPlace | null> {
  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(query);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'SyntraApp/1.0' },
    });
    if (!response.ok) {
      console.warn('Geocode failed:', response.status);
      return null;
    }
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const first = data[0];
    return {
      name: first.display_name,
      lat: parseFloat(first.lat),
      lng: parseFloat(first.lon),
    };
  } catch (e) {
    console.warn('Geocode error:', e);
    return null;
  }
}

function daysBetween(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
}

function assessRisk(
  totalBudget: number,
  estimatedTripCost: number
): { level: RiskLevel; message: string } {
  const remaining = totalBudget - estimatedTripCost;
  const usedPercent = totalBudget > 0 ? (estimatedTripCost / totalBudget) * 100 : 100;

  if (usedPercent <= 50) {
    return { level: 'safe', message: 'This trip fits comfortably within your budget.' };
  }
  if (usedPercent <= 80) {
    return { level: 'tight', message: 'This trip uses most of your available funds. Consider a shorter trip or lower-cost style.' };
  }
  return {
    level: 'risky',
    message:
      remaining < 0
        ? 'This trip exceeds your available budget. Reduce the number of days or choose a cheaper trip style.'
        : 'This trip uses nearly all your funds, leaving little safety margin. Consider fewer days.',
  };
}

function calculateReadiness(totalBudget: number, estimatedTripCost: number): { score: number; label: string } {
  if (estimatedTripCost <= 0) return { score: 0, label: 'Not enough info' };
  const ratio = totalBudget / estimatedTripCost;

  let score = Math.min(100, Math.round(ratio * 50));
  let label = '';

  if (ratio >= 2) {
    label = 'Great time to go';
  } else if (ratio >= 1.3) {
    label = 'Good to go';
  } else if (ratio >= 1) {
    label = 'Affordable but tight';
  } else {
    label = 'Consider waiting or saving more first';
  }

  return { score, label };
}

export async function buildTripPlan(
  destinationQuery: string,
  totalBudget: number,
  dailyCostEstimate: number,
  startDate: string,
  endDate: string
): Promise<TripPlan | null> {
  const geo = await geocodeDestination(destinationQuery);
  if (!geo) return null;

  const selectedDays = daysBetween(startDate, endDate);
  const affordableDays = dailyCostEstimate > 0 ? Math.floor(totalBudget / dailyCostEstimate) : 0;
  const estimatedTripCost = selectedDays * dailyCostEstimate;
  const remainingAfterTrip = totalBudget - estimatedTripCost;

  const risk = assessRisk(totalBudget, estimatedTripCost);
  const readiness = calculateReadiness(totalBudget, estimatedTripCost);

  const accommodationBudget = Math.round(estimatedTripCost * 0.4);
  const foodBudget = Math.round(estimatedTripCost * 0.3);
  const activitiesBudget = Math.round(estimatedTripCost * 0.3);

  const [hotels, restaurants, attractions, weather] = await Promise.all([
    searchNearbyPlaces({ latitude: geo.lat, longitude: geo.lng, type: 'lodging', radius: 5000 }),
    searchNearbyPlaces({ latitude: geo.lat, longitude: geo.lng, type: 'restaurant', radius: 3000 }),
    searchNearbyPlaces({ latitude: geo.lat, longitude: geo.lng, type: 'attraction', radius: 6000 }),
    getWeatherForecast(geo.lat, geo.lng, selectedDays),
  ]);

  return {
    destination: geo.name,
    lat: geo.lat,
    lng: geo.lng,
    totalBudget,
    dailyCostEstimate,
    affordableDays,
    selectedDays,
    estimatedTripCost,
    remainingAfterTrip,
    riskLevel: risk.level,
    riskMessage: risk.message,
    accommodationBudget,
    foodBudget,
    activitiesBudget,
    hotels,
    restaurants,
    attractions,
    weather,
    readinessScore: readiness.score,
    readinessLabel: readiness.label,
  };
}