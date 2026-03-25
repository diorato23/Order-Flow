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

export default function DashboardSkeleton() {
  return (
    <View style={styles.container}>
      {/* Stats Cards Row */}
      <View style={styles.statsRow}>
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} style={styles.statCard}>
            <SkeletonBlock width={32} height={32} borderRadius={10} />
            <SkeletonBlock width="60%" height={24} />
            <SkeletonBlock width="80%" height={12} />
          </View>
        ))}
      </View>

      {/* Revenue Card */}
      <View style={styles.revenueCard}>
        <SkeletonBlock width={120} height={16} />
        <SkeletonBlock width={160} height={32} />
        <SkeletonBlock width="100%" height={100} borderRadius={8} />
      </View>

      {/* Recent Orders */}
      <View style={styles.recentCard}>
        <SkeletonBlock width={140} height={16} />
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} style={styles.orderRow}>
            <SkeletonBlock width={40} height={40} borderRadius={10} />
            <View style={styles.orderInfo}>
              <SkeletonBlock width={100} height={14} />
              <SkeletonBlock width={60} height={12} />
            </View>
            <SkeletonBlock width={60} height={14} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.charcoal,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    alignItems: 'center',
  },
  revenueCard: {
    backgroundColor: Colors.charcoal,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  recentCard: {
    backgroundColor: Colors.charcoal,
    borderRadius: 16,
    padding: 20,
    gap: 14,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orderInfo: {
    flex: 1,
    gap: 4,
  },
});
