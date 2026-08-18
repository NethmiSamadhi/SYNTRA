// components/DreamClimbPath.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/lib/theme';

interface DreamClimbPathProps {
  progressPct: number;
  categoryEmoji: string;
}

const CHECKPOINTS = 5;

export function DreamClimbPath({ progressPct, categoryEmoji }: DreamClimbPathProps) {
  const clampedPct = Math.max(0, Math.min(100, progressPct));
  const activeCheckpoint = Math.round((clampedPct / 100) * (CHECKPOINTS - 1));

  return (
    <View style={styles.container}>
      {Array.from({ length: CHECKPOINTS }).map((_, index) => {
        const reversedIndex = CHECKPOINTS - 1 - index;
        const isReached = reversedIndex <= activeCheckpoint;
        const isCurrent = reversedIndex === activeCheckpoint;

        return (
          <View key={index} style={styles.stepWrap}>
            <View
              style={[
                styles.dot,
                isReached && styles.dotReached,
                isCurrent && styles.dotCurrent,
              ]}
            >
              {isCurrent && <Text style={styles.emoji}>{categoryEmoji}</Text>}
            </View>
            {index < CHECKPOINTS - 1 && (
              <View style={[styles.line, isReached && styles.lineReached]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 32,
  },
  stepWrap: {
    alignItems: 'center',
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotReached: {
    backgroundColor: `${colors.primary[500]}40`,
    borderColor: colors.primary[400],
  },
  dotCurrent: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[300],
  },
  emoji: {
    fontSize: 14,
  },
  line: {
    width: 2,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  lineReached: {
    backgroundColor: colors.primary[400],
  },
});