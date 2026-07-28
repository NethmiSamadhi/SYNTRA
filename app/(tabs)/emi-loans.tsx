import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { Landmark, Menu, Plus, Trash2, ChevronDown, ChevronUp, CalendarClock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, borderRadius, typography, spacing, shadows } from '@/lib/theme';
import { useTheme } from '@/lib/ThemeContext';
import { useUser } from '@/lib/UserContext';
import { useData } from '@/lib/DataContext';
import { useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { formatCurrency, EMILoan } from '@/lib/types';
import { getEMILoans, createEMILoan, deleteEMILoan } from '@/lib/services/emiLoans';
import { calculateEMI, generateAmortizationSchedule, totalInterestPaid } from '@/lib/utils/loanCalculations';
import { InputField } from '@/components/ui/InputField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { AnimatedScale } from '@/components/ui/AnimatedScale';

const CATEGORIES: EMILoan['category'][] = ['Vehicle', 'Home', 'Education', 'Personal', 'Other'];

export default function EMILoansScreen() {
  const { isDarkMode, backgroundColor, textPrimary, textSecondary, cardBackground, borderColor } = useTheme();
  const { user } = useUser();
  const { refreshKey, triggerRefresh } = useData();
  const navigation = useNavigation();
  const displayCurrency = (amount: number) => formatCurrency(amount, user?.currency);

  const [loans, setLoans] = useState<EMILoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<EMILoan['category']>('Vehicle');
  const [principal, setPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [termMonths, setTermMonths] = useState('');

  useEffect(() => {
    load();
  }, [refreshKey]);

  const load = async () => {
    try {
      setLoading(true);
      setLoans(await getEMILoans());
    } catch (e) {
      console.error('Error loading EMI loans:', e);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setCategory('Vehicle');
    setPrincipal('');
    setInterestRate('');
    setTermMonths('');
  };

  const handleAdd = async () => {
    const p = parseFloat(principal);
    const r = parseFloat(interestRate);
    const t = parseInt(termMonths, 10);
    if (!name || !p || p <= 0 || !t || t <= 0) {
      const msg = 'Please fill in name, principal, and term (interest rate can be 0).';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Missing info', msg);
      return;
    }
    try {
      setSaving(true);
      await createEMILoan({
        name,
        category,
        principal: p,
        interestRate: isNaN(r) ? 0 : r,
        termMonths: t,
        startDate: new Date().toISOString(),
      });
      resetForm();
      setShowForm(false);
      triggerRefresh();
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch (e) {
      console.error('Error adding EMI loan:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteEMILoan(id);
    triggerRefresh();
    await load();
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const totalEMI = loans.reduce((sum, l) => sum + calculateEMI(l.principal, l.interestRate, l.termMonths), 0);
  const totalOutstanding = loans.reduce((sum, l) => sum + l.remaining, 0);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown} style={styles.header}>
          <View style={styles.headerLeft}>
            <AnimatedScale
              onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
              style={[styles.iconButton, { backgroundColor: `${colors.primary[500]}10`, marginRight: spacing.md }]}
            >
              <Menu size={22} color={textSecondary} />
            </AnimatedScale>
            <View style={[styles.headerIcon, { backgroundColor: `${colors.primary[500]}15` }]}>
              <Landmark size={28} color={colors.primary[500]} />
            </View>
          </View>
          <View>
            {/* UPDATED TITLE BRANDING FROM EMI LOANS TO SYNTRA LOANS TRACKER */}
            <Text style={[styles.title, { color: textPrimary }]}>Syntra EMI Loans</Text>
            <Text style={[styles.subtitle, { color: textSecondary }]}>Vehicle, home & education loan tracking</Text>
          </View>
        </Animated.View>

        <View style={styles.cardContainer}>
          <View style={[styles.summaryStrip, { backgroundColor: cardBackground, borderColor }]}>
            <View style={styles.summaryStripItem}>
              <Text style={[styles.summaryLabel, { color: textSecondary }]}>Total Outstanding</Text>
              <Text style={[styles.summaryValue, { color: colors.error }]}>{displayCurrency(totalOutstanding)}</Text>
            </View>
            <View style={styles.summaryStripItem}>
              <Text style={[styles.summaryLabel, { color: textSecondary }]}>Monthly EMI Total</Text>
              <Text style={[styles.summaryValue, { color: textPrimary }]}>{displayCurrency(totalEMI)}</Text>
            </View>
          </View>

          {!showForm ? (
            <AnimatedScale onPress={() => setShowForm(true)} style={[styles.addLoanBtn, { borderColor }]}>
              <Plus size={18} color={colors.primary[500]} />
              <Text style={[styles.addLoanBtnText, { color: colors.primary[500] }]}>Add EMI Loan</Text>
            </AnimatedScale>
          ) : (
            <Animated.View entering={FadeInDown} style={[styles.stepCard, { backgroundColor: cardBackground, borderColor }]}>
              <Text style={[styles.cardTitle, { color: textPrimary, marginBottom: spacing.lg }]}>New EMI Loan</Text>
              <InputField label="Loan Name" placeholder="e.g. Car Loan" value={name} onChangeText={setName} />
              <View style={styles.typeRow}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCategory(c)}
                    style={[
                      styles.typeChip,
                      {
                        backgroundColor: category === c ? colors.primary[500] : 'transparent',
                        borderColor: category === c ? colors.primary[500] : borderColor,
                      },
                    ]}
                  >
                    <Text style={{ color: category === c ? '#fff' : textSecondary, fontSize: typography.fontSizes.xs, fontWeight: '600' }}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <InputField label="Principal Amount" placeholder="0.00" value={principal} onChangeText={setPrincipal} keyboardType="numeric" prefix="Rs." />
              <InputField label="Annual Interest Rate (%)" placeholder="e.g. 12" value={interestRate} onChangeText={setInterestRate} keyboardType="numeric" />
              <InputField label="Term (months)" placeholder="e.g. 36" value={termMonths} onChangeText={setTermMonths} keyboardType="numeric" />

              {parseFloat(principal) > 0 && parseInt(termMonths, 10) > 0 && (
                <View style={[styles.previewBox, { backgroundColor: `${colors.primary[500]}10` }]}>
                  <Text style={[styles.previewText, { color: colors.primary[500] }]}>
                    Estimated EMI: {displayCurrency(calculateEMI(parseFloat(principal) || 0, parseFloat(interestRate) || 0, parseInt(termMonths, 10) || 1))}/mo
                  </Text>
                </View>
              )}

              <View style={styles.buttonRow}>
                <PrimaryButton title="Cancel" onPress={() => { setShowForm(false); resetForm(); }} variant="ghost" style={{ flex: 1 }} />
                <PrimaryButton title="Save Loan" onPress={handleAdd} loading={saving} disabled={saving} style={{ flex: 2 }} />
              </View>
            </Animated.View>
          )}

          <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
            {loans.map((loan) => {
              const emi = calculateEMI(loan.principal, loan.interestRate, loan.termMonths);
              const expanded = expandedId === loan.id;
              return (
                <Animated.View key={loan.id} entering={FadeInRight} style={[styles.loanCard, { backgroundColor: cardBackground, borderColor }]}>
                  <TouchableOpacity style={styles.loanCardHeader} onPress={() => setExpandedId(expanded ? null : loan.id)}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.loanName, { color: textPrimary }]}>{loan.name}</Text>
                      <Text style={[styles.loanType, { color: textSecondary }]}>{loan.category} · {loan.termMonths}mo · {loan.interestRate}%</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.loanEmi, { color: colors.primary[500] }]}>{displayCurrency(emi)}/mo</Text>
                      <Text style={[styles.loanRemaining, { color: textSecondary }]}>{displayCurrency(loan.remaining)} left</Text>
                    </View>
                    {expanded ? <ChevronUp size={18} color={textSecondary} /> : <ChevronDown size={18} color={textSecondary} />}
                  </TouchableOpacity>

                  {expanded && (
                    <View style={styles.scheduleBox}>
                      <View style={styles.scheduleRow}>
                        <CalendarClock size={16} color={textSecondary} />
                        <Text style={[styles.scheduleText, { color: textSecondary }]}>
                          Total interest over term: {displayCurrency(totalInterestPaid(loan))}
                        </Text>
                      </View>
                      <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
                        {generateAmortizationSchedule(loan).slice(0, 12).map((row) => (
                          <View key={row.monthIndex} style={styles.scheduleLine}>
                            <Text style={[styles.scheduleLineText, { color: textSecondary }]}>#{row.monthIndex}</Text>
                            <Text style={[styles.scheduleLineText, { color: textPrimary }]}>{displayCurrency(row.emiAmount)}</Text>
                            <Text style={[styles.scheduleLineText, { color: textSecondary }]}>bal {displayCurrency(row.remainingBalance)}</Text>
                          </View>
                        ))}
                      </ScrollView>
                      <TouchableOpacity onPress={() => handleDelete(loan.id)} style={styles.deleteRow}>
                        <Trash2 size={16} color={colors.error} />
                        <Text style={{ color: colors.error, fontSize: typography.fontSizes.sm, fontWeight: '600' }}>Delete Loan</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </Animated.View>
              );
            })}

            {loans.length === 0 && !showForm && (
              <Text style={[styles.emptyText, { color: textSecondary }]}>No EMI loans tracked yet. Add one above.</Text>
            )}
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xl },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.xl, gap: spacing.md },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerIcon: { width: 56, height: 56, borderRadius: borderRadius['2xl'], alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  title: { fontSize: typography.fontSizes['2xl'], fontWeight: typography.fontWeights.bold },
  subtitle: { fontSize: typography.fontSizes.sm, opacity: 0.8 },
  cardContainer: { paddingHorizontal: spacing.xl },
  summaryStrip: { flexDirection: 'row', padding: spacing.lg, borderRadius: borderRadius['2xl'], borderWidth: 1, marginBottom: spacing.lg, ...shadows.md },
  summaryStripItem: { flex: 1 },
  summaryLabel: { fontSize: typography.fontSizes.xs, marginBottom: 4 },
  summaryValue: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.bold },
  addLoanBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.lg, borderRadius: borderRadius.xl, borderWidth: 1, borderStyle: 'dashed' },
  addLoanBtnText: { marginLeft: spacing.sm, fontWeight: '600', fontSize: typography.fontSizes.md },
  stepCard: { padding: spacing.xl, borderRadius: borderRadius['3xl'], borderWidth: 1, ...shadows.xl },
  cardTitle: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.bold },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  typeChip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.full, borderWidth: 1 },
  previewBox: { padding: spacing.md, borderRadius: borderRadius.lg, marginBottom: spacing.md },
  previewText: { fontSize: typography.fontSizes.sm, fontWeight: '600', textAlign: 'center' },
  buttonRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  loanCard: { borderRadius: borderRadius['2xl'], borderWidth: 1, overflow: 'hidden', ...shadows.md },
  loanCardHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md },
  loanName: { fontSize: typography.fontSizes.md, fontWeight: typography.fontWeights.bold },
  loanType: { fontSize: typography.fontSizes.xs, marginTop: 2 },
  loanEmi: { fontSize: typography.fontSizes.md, fontWeight: typography.fontWeights.bold },
  loanRemaining: { fontSize: typography.fontSizes.xs, marginTop: 2 },
  scheduleBox: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.2)', paddingTop: spacing.md },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  scheduleText: { fontSize: typography.fontSizes.xs },
  scheduleLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  scheduleLineText: { fontSize: typography.fontSizes.xs },
  deleteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, alignSelf: 'flex-start' },
  emptyText: { textAlign: 'center', fontSize: typography.fontSizes.sm, marginTop: spacing.xl, opacity: 0.7 },
  iconButton: { width: 44, height: 44, borderRadius: borderRadius.xl, alignItems: 'center', justifyContent: 'center' },
});