// app/(tabs)/shopping-recommendations.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ShoppingBag, Menu, MapPin, Search, List, Map as MapIcon } from 'lucide-react-native';
import { colors, borderRadius, typography, spacing, shadows } from '@/lib/theme';
import { useTheme } from '@/lib/ThemeContext';
import { useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { AnimatedScale } from '@/components/ui/AnimatedScale';
import { useLocation } from '@/lib/hooks/useLocation';
import { getShoppingRecommendations, ShoppingRecommendation } from '@/lib/services/shoppingRecommendations';
import { PlacesMapView } from '@/components/PlacesMapView';

const CATEGORIES = ['Shopping', 'Food', 'Groceries', 'Electronics', 'Clothing'];

export default function ShoppingRecommendationsScreen() {
  const { backgroundColor, textPrimary, textSecondary, cardBackground, borderColor } = useTheme();
  const navigation = useNavigation();
  const locationHook = useLocation();
  const location = locationHook.location;
  const errorMsg = locationHook.errorMsg;
  const locationLoading = locationHook.loading;

  const [selectedCategory, setSelectedCategory] = useState('Shopping');
  const [productQuery, setProductQuery] = useState('');
  const [recommendation, setRecommendation] = useState<ShoppingRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Tracks the most recent request so stale/duplicate responses are ignored
  const requestIdRef = useRef(0);
  // Simple cache so re-tapping a category you've already loaded doesn't refetch
  const cacheRef = useRef<Map<string, ShoppingRecommendation>>(new Map());

  const load = useCallback(
    async (category: string, lat: number, lng: number, query?: string) => {
      const cacheKey = category + '|' + query;
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        setRecommendation(cached);
        return;
      }

      const myRequestId = ++requestIdRef.current;
      setLoading(true);
      try {
        const result = await getShoppingRecommendations(category, { latitude: lat, longitude: lng }, query);

        // Ignore this result if a newer request has started since
        if (myRequestId !== requestIdRef.current) return;

        if (result) {
          cacheRef.current.set(cacheKey, result);
          setRecommendation(result);
        }
      } catch (e) {
        console.error('Error loading shopping recommendations:', e);
      } finally {
        if (myRequestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (location) {
      load(selectedCategory, location.latitude, location.longitude, productQuery.trim() || undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.latitude, location?.longitude, selectedCategory]);

  const handleManualSearch = () => {
    if (location) {
      load(selectedCategory, location.latitude, location.longitude, productQuery.trim() || undefined);
    }
  };

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
            <ShoppingBag size={28} color={colors.primary[500]} />
          </View>
          <View>
            <Text style={[styles.title, { color: textPrimary }]}>Smart Shopping</Text>
            <Text style={[styles.subtitle, { color: textSecondary }]}>Find shops near you</Text>
          </View>
        </Animated.View>

        <View style={styles.cardContainer}>
          <View style={[styles.searchBox, { backgroundColor: cardBackground, borderColor }]}>
            <Search size={18} color={textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: textPrimary }]}
              placeholder="What are you looking for? e.g. laptop"
              placeholderTextColor={textSecondary}
              value={productQuery}
              onChangeText={setProductQuery}
              onSubmitEditing={handleManualSearch}
              returnKeyType="search"
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: isSelected ? colors.primary[500] : cardBackground,
                      borderColor: isSelected ? colors.primary[500] : borderColor,
                    },
                  ]}
                >
                  <Text style={{ color: isSelected ? '#fff' : textPrimary, fontWeight: '600' }}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {recommendation && recommendation.places.length > 0 && (
            <View style={[styles.toggleRow, { borderColor }]}>
              <TouchableOpacity
                onPress={() => setViewMode('list')}
                style={[styles.toggleBtn, viewMode === 'list' && { backgroundColor: colors.primary[500] }]}
              >
                <List size={16} color={viewMode === 'list' ? '#fff' : textSecondary} />
                <Text style={{ color: viewMode === 'list' ? '#fff' : textSecondary, fontWeight: '600', marginLeft: 6 }}>
                  List
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setViewMode('map')}
                style={[styles.toggleBtn, viewMode === 'map' && { backgroundColor: colors.primary[500] }]}
              >
                <MapIcon size={16} color={viewMode === 'map' ? '#fff' : textSecondary} />
                <Text style={{ color: viewMode === 'map' ? '#fff' : textSecondary, fontWeight: '600', marginLeft: 6 }}>
                  Map
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {locationLoading || loading ? (
            <ActivityIndicator size="large" color={colors.primary[500]} style={{ marginTop: spacing.xl }} />
          ) : errorMsg ? (
            <Text style={[styles.emptyText, { color: textSecondary }]}>
              Location permission is needed to show nearby recommendations.
            </Text>
          ) : !recommendation ? (
            <Text style={[styles.emptyText, { color: textSecondary }]}>
              Search above to find nearby places.
            </Text>
          ) : (
            <View>
              <View style={[styles.budgetBanner, { backgroundColor: colors.primary[500] + '10' }]}>
                <Text style={[styles.budgetText, { color: colors.primary[500] }]}>
                  Remaining {selectedCategory} budget: Rs. {recommendation.remainingBudget.toLocaleString()}
                </Text>
              </View>

              {recommendation.places.length === 0 ? (
                <Text style={[styles.emptyText, { color: textSecondary }]}>
                  No matching places found nearby. Try a different category or search term.
                </Text>
              ) : viewMode === 'map' && location ? (
                <PlacesMapView
                  places={recommendation.places}
                  centerLat={location.latitude}
                  centerLng={location.longitude}
                />
              ) : (
                recommendation.places.map((place) => (
                  <View key={place.id} style={[styles.placeCard, { backgroundColor: cardBackground, borderColor }]}>
                    <View style={styles.placeInfo}>
                      <Text style={[styles.placeName, { color: textPrimary }]}>{place.name}</Text>
                      <View style={styles.placeRow}>
                        <MapPin size={12} color={textSecondary} />
                        <Text style={[styles.placeAddress, { color: textSecondary }]} numberOfLines={1}>
                          {place.address}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>
        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
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
  searchBox: { flexDirection: 'row', alignItems: 'center', borderRadius: borderRadius.lg, borderWidth: 1, paddingHorizontal: spacing.md, marginBottom: spacing.md, height: 48 },
  searchInput: { flex: 1, marginLeft: spacing.sm, fontSize: typography.fontSizes.md },
  categoryChip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.full, borderWidth: 1, marginRight: spacing.sm },
  toggleRow: { flexDirection: 'row', borderRadius: borderRadius.lg, borderWidth: 1, marginBottom: spacing.md, overflow: 'hidden' },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm },
  budgetBanner: { padding: spacing.md, borderRadius: borderRadius.lg, marginBottom: spacing.md },
  budgetText: { fontWeight: '700', textAlign: 'center' },
  placeCard: { flexDirection: 'row', borderRadius: borderRadius.xl, borderWidth: 1, marginBottom: spacing.md, overflow: 'hidden', ...shadows.sm },
  placeInfo: { flex: 1, padding: spacing.md, gap: 4 },
  placeName: { fontSize: typography.fontSizes.md, fontWeight: '700' },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  placeAddress: { fontSize: typography.fontSizes.xs, flex: 1 },
  emptyText: { textAlign: 'center', marginTop: spacing.xl, opacity: 0.7 },
  iconButton: { width: 44, height: 44, borderRadius: borderRadius.xl, alignItems: 'center', justifyContent: 'center' },
});