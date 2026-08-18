// app/(tabs)/simulator.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, Sparkles } from 'lucide-react-native';
import { useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { colors, borderRadius, typography, spacing } from '@/lib/theme';
import { useTheme } from '@/lib/ThemeContext';
import { AnimatedScale } from '@/components/ui/AnimatedScale';
import { saveSimulation } from '@/lib/services/simulations';
import type { SimulationResult, SimulationType } from '@/lib/types';

export default function Simulator() {
  const { backgroundColor, textPrimary, textSecondary, cardBackground, borderColor } = useTheme();
  const navigation = useNavigation();

  const [cost, setCost] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [result, setResult] = useState<SimulationResult | null>(null);

  const handleSimulate = async () => {
    const costNum = parseFloat(cost) || 0;
    const downPaymentNum = parseFloat(downPayment) || 0;
    const interestRateNum = parseFloat(interestRate) || 0;
    const termMonthsNum = parseInt(termMonths, 10) || 0;

    const principal = costNum - downPaymentNum;
    const monthlyRate = interestRateNum / 100 / 12;
    const monthlyEMI =
      monthlyRate > 0
        ? (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonthsNum)) /
          (Math.pow(1 + monthlyRate, termMonthsNum) - 1)
        : principal / termMonthsNum;

    const totalCost = monthlyEMI * termMonthsNum + downPaymentNum;
    const totalInterestPaid = totalCost - costNum;

    const simResult: SimulationResult = {
      id: Date.now().toString(),
      type: 'loan' as SimulationType,
      label: 'Simulation',
      cost: costNum,
      downPayment: downPaymentNum,
      interestRate: interestRateNum,
      termMonths: termMonthsNum,
      monthlyEMI,
      totalInterestPaid,
      totalCost,
      newDebtToIncomeRatio: 0,
      affordabilityVerdict: 'unknown',
      projectedMonthlyLeftover: 0,
      createdAt: new Date().toISOString(),
    };

    await saveSimulation(simResult);
    setResult(simResult);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <AnimatedScale
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
            style={[styles.iconButton, { backgroundColor: colors.primary[500] + '10', marginRight: spacing.md }]}
          >
            <Menu size={22} color={textSecondary} />
          </AnimatedScale>
          <View style={[styles.headerIcon, { backgroundColor: colors.primary[500] + '15' }]}>
            <Sparkles size={28} color={colors.primary[500]} />
          </View>
          <View>
            <Text style={[styles.title, { color: textPrimary }]}>What-If Simulator</Text>
            <Text style={[styles.subtitle, { color: textSecondary }]}>Test loan scenarios</Text>
          </View>
        </View>

        <View style={styles.form}>
          <TextInput
            style={[styles.input, { backgroundColor: cardBackground, borderColor, color: textPrimary }]}
            placeholder="Cost"
            placeholderTextColor={textSecondary}
            keyboardType="numeric"
            value={cost}
            onChangeText={setCost}
          />
          <TextInput
            style={[styles.input, { backgroundColor: cardBackground, borderColor, color: textPrimary }]}
            placeholder="Down Payment"
            placeholderTextColor={textSecondary}
            keyboardType="numeric"
            value={downPayment}
            onChangeText={setDownPayment}
          />
          <TextInput
            style={[styles.input, { backgroundColor: cardBackground, borderColor, color: textPrimary }]}
            placeholder="Interest Rate (%)"
            placeholderTextColor={textSecondary}
            keyboardType="numeric"
            value={interestRate}
            onChangeText={setInterestRate}
          />
          <TextInput
            style={[styles.input, { backgroundColor: cardBackground, borderColor, color: textPrimary }]}
            placeholder="Term (months)"
            placeholderTextColor={textSecondary}
            keyboardType="numeric"
            value={termMonths}
            onChangeText={setTermMonths}
          />

          <TouchableOpacity style={styles.button} onPress={handleSimulate}>
            <Text style={styles.buttonText}>Simulate</Text>
          </TouchableOpacity>

          {result && (
            <View style={[styles.resultCard, { backgroundColor: cardBackground, borderColor }]}>
              <Text style={[styles.resultLabel, { color: textSecondary }]}>Monthly EMI</Text>
              <Text style={[styles.resultValue, { color: textPrimary }]}>
                Rs. {result.monthlyEMI.toFixed(2)}
              </Text>
              <Text style={[styles.resultLabel, { color: textSecondary, marginTop: spacing.md }]}>
                Total Interest
              </Text>
              <Text style={[styles.resultValue, { color: textPrimary }]}>
                Rs. {result.totalInterestPaid.toFixed(2)}
              </Text>
              <Text style={[styles.resultLabel, { color: textSecondary, marginTop: spacing.md }]}>
                Total Cost
              </Text>
              <Text style={[styles.resultValue, { color: textPrimary }]}>
                Rs. {result.totalCost.toFixed(2)}
              </Text>
            </View>
          )}
        </View>
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
  form: { paddingHorizontal: spacing.xl },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    fontSize: typography.fontSizes.md,
  },
  button: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  resultCard: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  resultLabel: { fontSize: typography.fontSizes.sm },
  resultValue: { fontSize: typography.fontSizes.xl, fontWeight: '700' },
  iconButton: { width: 44, height: 44, borderRadius: borderRadius.xl, alignItems: 'center', justifyContent: 'center' },
});