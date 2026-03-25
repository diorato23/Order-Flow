import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Colors from '@/constants/colors';

function SkeletonBlock({ width, height, borderRadius = 4, style }: {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1000 }),
        withTiming(0.3, { duration: 1000 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: Colors.warmDark },
        animatedStyle,
        style,
      ]}
    />
  );
}

function TableCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.cardInner}>
        <View style={styles.cardHeader}>
          <SkeletonBlock width={8} height={8} borderRadius={4} />
          <SkeletonBlock width={16} height={16} borderRadius={8} />
        </View>
        <SkeletonBlock width={80} height={20} />
        <View style={styles.capacityRow}>
          <SkeletonBlock width={12} height={12} borderRadius={6} />
          <SkeletonBlock width={20} height={12} />
        </View>
        <SkeletonBlock width={70} height={22} borderRadius={8} />
      </View>
    </View>
  );
}

export default function TableSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <TableCardSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 10,
  },
  card: {
    width: '47%',
    margin: 5,
  },
  cardInner: {
    backgroundColor: Colors.charcoal,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surface,
    minHeight: 140,
    justifyContent: 'space-between',
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
