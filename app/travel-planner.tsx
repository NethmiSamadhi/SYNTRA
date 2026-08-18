// app/(tabs)/travel-planner.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Plane,
  Menu,
  MapPin,
  Search,
  Hotel,
  UtensilsCrossed,
  Landmark,
  Cloud,
  CalendarDays,
  Bookmark,
  Trash2,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react-native';
import { colors, borderRadius, typography, spacing, shadows } from '@/lib/theme';
import { useTheme } from '@/lib/ThemeContext';
import { useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { AnimatedScale } from '@/components/ui/AnimatedScale';
import {
  TRIP_STYLES,
  TripStyle,
  TripPlan,
  getSuggestedBudget,
  buildTripPlan,
} from '@/lib/services/travelPlanner';
import {
  saveTripPlan,
  getSavedTrips,
  deleteTripPlan,
  SavedTripPlan,
} from '@/lib/services/tripPlans';
import { useUser } from '@/lib/UserContext';
import { formatCurrency } from '@/lib/types';

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const RISK_COLORS: Record<string, string> = {
  safe: colors.success,
  tight: '#f59e0b',
  risky: colors.error,
};

export default function TravelPlannerScreen() {
  const { backgroundColor, textPrimary, textSecondary, cardBackground, borderColor } = useTheme();
  const { user } = useUser();
  const navigation = useNavigation();

  const [destination, setDestination] = useState('');
  const [budget, setBudget] = useState('');
  const [startDate, setStartDate] = useState(todayPlus(14));
  const [endDate, setEndDate] = useState(todayPlus(17));
  const [selectedStyle, setSelectedStyle] = useState<TripStyle>(TRIP_STYLES[0]);
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedTrips, setSavedTrips] = useState<SavedTripPlan[]>([]);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    loadSuggestedBudget();
    loadSavedTrips();
  }, []);

  const loadSuggestedBudget = async () => {
    const suggested = await getSuggestedBudget();
    if (suggested > 0) setBudget(String(suggested));
  };

  const loadSavedTrips = async () => {
    const trips = await getSavedTrips();
    setSavedTrips(trips);
  };

  const handlePlanTrip = async () => {
    if (!destination.trim() || !budget) return;
    setLoading(true);
    setError('');
    setPlan(null);
    try {
      const result = await buildTripPlan(
        destination.trim(),
        parseFloat(budget),
        selectedStyle.dailyCost,
        startDate,
        endDate
      );
      if (!result) {
        setError('Could not find that destination. Try a different spelling or a nearby major city.');
      } else {
        setPlan(result);
      }
    } catch (e) {
      setError('Something went wrong planning your trip. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTrip = async () => {
    if (!plan) return;
    await saveTripPlan({
      destination: plan.destination,
      lat: plan.lat,
      lng: plan.lng,
      startDate,
      endDate,
      totalBudget: plan.totalBudget,
      dailyCostEstimate: plan.dailyCostEstimate,
      styleLabel: selectedStyle.label,
      accommodationBudget: plan.accommodationBudget,
      foodBudget: plan.foodBudget,
      activitiesBudget: plan.activitiesBudget,
    });
    await loadSavedTrips();
    Alert.alert('Saved', 'Trip plan saved. You can compare it with others below.');
  };

  const handleDeleteSavedTrip = (id: string) => {
    Alert.alert('Delete Trip', 'Remove this saved trip plan?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTripPlan(id);
          await loadSavedTrips();
        },
      },
    ]);
  };

  const displayCurrency = (amount: number) => formatCurrency(amount, user?.currency);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown} style={styles.header}>
          <AnimatedScale
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
            style={[styles.iconButton, { backgroundColor: colors.primary[500] + '10', marginRight: spacing.md }]}
          >
            <Menu size={22} color={textSecondary} />
          </AnimatedScale>
          <View style={[styles.headerIcon, { backgroundColor: colors.primary[500] + '15' }]}>
            <Plane size={28} color={colors.primary[500]} />
          </View>
          <View>
            <Text style={[styles.title, { color: textPrimary }]}>Travel Planner</Text>
            <Text style={[styles.subtitle, { color: textSecondary }]}>Plan a trip within your budget</Text>
          </View>
        </Animated.View>

        <View style={styles.cardContainer}>
          {/* Destination */}
          <View style={[styles.searchBox, { backgroundColor: cardBackground, borderColor }]}>
            <Search size={18} color={textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: textPrimary }]}
              placeholder="Where do you want to go? e.g. Kandy"
              placeholderTextColor={textSecondary}
              value={destination}
              onChangeText={setDestination}
              returnKeyType="search"
            />
          </View>

          {/* Budget */}
          <Text style={[styles.label, { color: textPrimary }]}>Trip Budget</Text>
          <View style={[styles.searchBox, { backgroundColor: cardBackground, borderColor, marginBottom: spacing.md }]}>
            <Text style={{ color: textSecondary, fontWeight: '700' }}>Rs.</Text>
            <TextInput
              style={[styles.searchInput, { color: textPrimary }]}
              placeholder="0"
              placeholderTextColor={textSecondary}
              value={budget}
              onChangeText={setBudget}
              keyboardType="numeric"
            />
          </View>

          {/* Dates */}
          <Text style={[styles.label, { color: textPrimary }]}>Trip Dates</Text>
          <View style={styles.dateRow}>
            <View style={[styles.dateBox, { backgroundColor: cardBackground, borderColor }]}>
              <CalendarDays size={16} color={textSecondary} />
              <TextInput
                style={[styles.dateInput, { color: textPrimary }]}
                placeholder="Start YYYY-MM-DD"
                placeholderTextColor={textSecondary}
                value={startDate}
                onChangeText={setStartDate}
              />
            </View>
            <View style={[styles.dateBox, { backgroundColor: cardBackground, borderColor }]}>
              <CalendarDays size={16} color={textSecondary} />
              <TextInput
                style={[styles.dateInput, { color: textPrimary }]}
                placeholder="End YYYY-MM-DD"
                placeholderTextColor={textSecondary}
                value={endDate}
                onChangeText={setEndDate}
              />
            </View>
          </View>

          {/* Style */}
          <Text style={[styles.label, { color: textPrimary, marginTop: spacing.md }]}>Trip Style</Text>
          <View style={styles.styleRow}>
            {TRIP_STYLES.map((style) => {
              const isSelected = selectedStyle.id === style.id;
              return (
                <TouchableOpacity
                  key={style.id}
                  onPress={() => setSelectedStyle(style)}
                  style={[
                    styles.styleChip,
                    {
                      backgroundColor: isSelected ? colors.primary[500] : cardBackground,
                      borderColor: isSelected ? colors.primary[500] : borderColor,
                    },
                  ]}
                >
                  <Text style={{ color: isSelected ? '#fff' : textPrimary, fontWeight: '600' }}>
                    {style.label}
                  </Text>
                  <Text style={{ color: isSelected ? '#fff' : textSecondary, fontSize: 11, marginTop: 2 }}>
                    ~{displayCurrency(style.dailyCost)}/day
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={handlePlanTrip}
            disabled={!destination.trim() || !budget || loading}
            style={[
              styles.planButton,
              { backgroundColor: !destination.trim() || !budget || loading ? '#94a3b8' : colors.primary[500] },
            ]}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.planButtonText}>Plan My Trip</Text>}
          </TouchableOpacity>

          {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}

          {plan && (
            <View style={{ marginTop: spacing.xl }}>
              {/* Risk banner */}
              <View
                style={[
                  styles.riskBanner,
                  { backgroundColor: RISK_COLORS[plan.riskLevel] + '15', borderColor: RISK_COLORS[plan.riskLevel] },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <AlertTriangle size={16} color={RISK_COLORS[plan.riskLevel]} />
                  <Text style={[styles.riskTitle, { color: RISK_COLORS[plan.riskLevel], marginLeft: 6 }]}>
                    {plan.riskLevel === 'safe' ? 'Safe to travel' : plan.riskLevel === 'tight' ? 'Tight budget' : 'Risky trip'}
                  </Text>
                </View>
                <Text style={{ color: textSecondary, fontSize: 13 }}>{plan.riskMessage}</Text>
                <Text style={{ color: textPrimary, fontSize: 13, marginTop: 6, fontWeight: '600' }}>
                  {plan.selectedDays} days selected · You can safely afford up to {plan.affordableDays} days at this style
                </Text>
              </View>

              {/* Readiness score */}
              <View style={[styles.readinessCard, { backgroundColor: cardBackground, borderColor }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TrendingUp size={16} color={colors.primary[500]} />
                  <Text style={[styles.sectionTitle, { color: textPrimary, marginLeft: 6, marginTop: 0 }]}>
                    Trip Readiness
                  </Text>
                </View>
                <Text style={{ color: textPrimary, fontSize: 20, fontWeight: '700', marginTop: 4 }}>
                  {plan.readinessScore}/100
                </Text>
                <Text style={{ color: textSecondary, fontSize: 13 }}>{plan.readinessLabel}</Text>
              </View>

              {/* Cost summary */}
              <View style={[styles.resultBanner, { backgroundColor: colors.primary[500] + '10' }]}>
                <Text style={[styles.resultTitle, { color: colors.primary[500] }]}>{plan.destination}</Text>
                <Text style={{ color: textSecondary, marginTop: 4 }}>
                  Estimated trip cost:{' '}
                  <Text style={{ fontWeight: '700', color: textPrimary }}>{displayCurrency(plan.estimatedTripCost)}</Text>
                </Text>
                <Text style={{ color: textSecondary, marginTop: 2 }}>
                  Remaining after trip:{' '}
                  <Text style={{ fontWeight: '700', color: plan.remainingAfterTrip < 0 ? colors.error : textPrimary }}>
                    {displayCurrency(plan.remainingAfterTrip)}
                  </Text>
                </Text>
              </View>

              {/* Budget split */}
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>Budget Breakdown</Text>
              <View style={styles.splitRow}>
                <View style={[styles.splitCard, { backgroundColor: cardBackground, borderColor }]}>
                  <Text style={[styles.splitLabel, { color: textSecondary }]}>Stay</Text>
                  <Text style={[styles.splitAmount, { color: textPrimary }]}>{displayCurrency(plan.accommodationBudget)}</Text>
                </View>
                <View style={[styles.splitCard, { backgroundColor: cardBackground, borderColor }]}>
                  <Text style={[styles.splitLabel, { color: textSecondary }]}>Food</Text>
                  <Text style={[styles.splitAmount, { color: textPrimary }]}>{displayCurrency(plan.foodBudget)}</Text>
                </View>
                <View style={[styles.splitCard, { backgroundColor: cardBackground, borderColor }]}>
                  <Text style={[styles.splitLabel, { color: textSecondary }]}>Activities</Text>
                  <Text style={[styles.splitAmount, { color: textPrimary }]}>{displayCurrency(plan.activitiesBudget)}</Text>
                </View>
              </View>

              {/* Weather */}
              {plan.weather.length > 0 && (
                <View style={{ marginTop: spacing.lg }}>
                  <View style={styles.sectionHeaderRow}>
                    <Cloud size={16} color={colors.primary[500]} />
                    <Text style={[styles.sectionTitle, { color: textPrimary, marginLeft: 6, marginTop: 0 }]}>
                      Weather Forecast
                    </Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {plan.weather.map((day) => (
                      <View key={day.date} style={[styles.weatherCard, { backgroundColor: cardBackground, borderColor }]}>
                        <Text style={{ color: textSecondary, fontSize: 11 }}>{day.date.slice(5)}</Text>
                        <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 13, marginTop: 4 }}>
                          {Math.round(day.minTemp)}° - {Math.round(day.maxTemp)}°
                        </Text>
                        <Text style={{ color: textSecondary, fontSize: 11, marginTop: 2 }}>{day.condition}</Text>
                        <Text style={{ color: textSecondary, fontSize: 10, marginTop: 2 }}>
                          {day.precipitationChance}% rain
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Places */}
              <SectionList
                icon={<Hotel size={16} color={colors.primary[500]} />}
                title="Places to Stay"
                places={plan.hotels}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                cardBackground={cardBackground}
                borderColor={borderColor}
              />
              <SectionList
                icon={<UtensilsCrossed size={16} color={colors.primary[500]} />}
                title="Places to Eat"
                places={plan.restaurants}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                cardBackground={cardBackground}
                borderColor={borderColor}
              />
              <SectionList
                icon={<Landmark size={16} color={colors.primary[500]} />}
                title="Places to Explore"
                places={plan.attractions}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                cardBackground={cardBackground}
                borderColor={borderColor}
              />

              <TouchableOpacity
                onPress={handleSaveTrip}
                style={[styles.saveButton, { borderColor: colors.primary[500] }]}
              >
                <Bookmark size={16} color={colors.primary[500]} />
                <Text style={{ color: colors.primary[500], fontWeight: '700', marginLeft: 6 }}>Save This Trip</Text>
              </TouchableOpacity>

              <Text style={[styles.disclaimer, { color: textSecondary }]}>
                Daily cost and readiness score are estimates based on your budget, not real-time prices. Place listings come from OpenStreetMap and may be incomplete. No photos are shown since no free source of real hotel/restaurant images is available.
              </Text>
            </View>
          )}

          {/* Saved trips */}
          <TouchableOpacity onPress={() => setShowSaved(!showSaved)} style={{ marginTop: spacing.xl }}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>
              Saved Trips ({savedTrips.length}) {showSaved ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {showSaved &&
            savedTrips.map((trip) => (
              <View key={trip.id} style={[styles.savedTripCard, { backgroundColor: cardBackground, borderColor }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.placeName, { color: textPrimary }]}>{trip.destination}</Text>
                  <Text style={{ color: textSecondary, fontSize: 12 }}>
                    {trip.startDate} → {trip.endDate} · {trip.styleLabel}
                  </Text>
                  <Text style={{ color: textSecondary, fontSize: 12 }}>
                    Budget: {displayCurrency(trip.totalBudget)} · {trip.status === 'completed' ? 'Completed' : 'Planned'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteSavedTrip(trip.id)} style={{ padding: 8 }}>
                  <Trash2 size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
        </View>
        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionList({ icon, title, places, textPrimary, textSecondary, cardBackground, borderColor }: any) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <View style={styles.sectionHeaderRow}>
        {icon}
        <Text style={[styles.sectionTitle, { color: textPrimary, marginLeft: 6, marginTop: 0 }]}>{title}</Text>
      </View>
      {places.length === 0 ? (
        <Text style={[styles.emptyText, { color: textSecondary }]}>No results found nearby.</Text>
      ) : (
        places.slice(0, 6).map((place: any) => (
          <View key={place.id} style={[styles.placeCard, { backgroundColor: cardBackground, borderColor }]}>
            <Text style={[styles.placeName, { color: textPrimary }]}>{place.name}</Text>
            <View style={styles.placeRow}>
              <MapPin size={12} color={textSecondary} />
              <Text style={[styles.placeAddress, { color: textSecondary }]} numberOfLines={1}>
                {place.address}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.xl, gap: spacing.md },
  headerIcon: { width: 56, height: 56, borderRadius: borderRadius['2xl'], alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: typography.fontSizes['2xl'], fontWeight: typography.fontWeights.bold },
  subtitle: { fontSize: typography.fontSizes.sm, opacity: 0.8 },
  cardContainer: { paddingHorizontal: spacing.xl },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderRadius: borderRadius.lg, borderWidth: 1, paddingHorizontal: spacing.md, marginBottom: spacing.md, height: 48, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: typography.fontSizes.md },
  label: { fontSize: typography.fontSizes.sm, fontWeight: '600', marginBottom: spacing.sm },
  dateRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  dateBox: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: borderRadius.lg, borderWidth: 1, paddingHorizontal: spacing.sm, height: 44, gap: 6 },
  dateInput: { flex: 1, fontSize: 12 },
  styleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  styleChip: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, alignItems: 'center' },
  planButton: { paddingVertical: spacing.md, borderRadius: borderRadius.lg, alignItems: 'center' },
  planButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  errorText: { marginTop: spacing.md, fontSize: 13, textAlign: 'center' },
  riskBanner: { padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, marginBottom: spacing.md },
  riskTitle: { fontWeight: '700', fontSize: 14 },
  readinessCard: { padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, marginBottom: spacing.md },
  resultBanner: { padding: spacing.lg, borderRadius: borderRadius.lg, marginBottom: spacing.md },
  resultTitle: { fontSize: 18, fontWeight: '700' },
  sectionTitle: { fontSize: typography.fontSizes.md, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.sm },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  splitRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  splitCard: { flex: 1, padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, alignItems: 'center' },
  splitLabel: { fontSize: 12, marginBottom: 4 },
  splitAmount: { fontSize: 14, fontWeight: '700' },
  weatherCard: { padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, marginRight: spacing.sm, alignItems: 'center', minWidth: 80 },
  placeCard: { padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, marginBottom: spacing.sm },
  placeName: { fontSize: typography.fontSizes.md, fontWeight: '700', marginBottom: 4 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  placeAddress: { fontSize: typography.fontSizes.xs, flex: 1 },
  emptyText: { fontSize: 13, opacity: 0.7 },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: borderRadius.lg, paddingVertical: spacing.md, marginTop: spacing.lg },
  savedTripCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, marginTop: spacing.sm },
  disclaimer: { fontSize: 11, opacity: 0.6, marginTop: spacing.lg, lineHeight: 16 },
  iconButton: { width: 44, height: 44, borderRadius: borderRadius.xl, alignItems: 'center', justifyContent: 'center' },
});