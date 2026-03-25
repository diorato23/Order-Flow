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

export default function OrderSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <SkeletonBlock width={80} height={18} borderRadius={4} />
              <SkeletonBlock width={70} height={22} borderRadius={8} />
            </View>
            <View style={styles.headerRight}>
              <SkeletonBlock width={60} height={14} />
              <SkeletonBlock width={30} height={14} />
            </View>
          </View>

          {/* Items */}
          <View style={styles.items}>
            <View style={styles.itemRow}>
              <SkeletonBlock width={28} height={28} borderRadius={8} />
              <SkeletonBlock width={120} height={14} />
            </View>
            <View style={styles.itemRow}>
              <SkeletonBlock width={28} height={28} borderRadius={8} />
              <SkeletonBlock width={90} height={14} />
            </View>
          </View>

          {/* Action Button */}
          <SkeletonBlock width="100%" height={44} borderRadius={12} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    gap: 12,
    paddingTop: 4,
  },
  card: {
    backgroundColor: Colors.charcoal,
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warmDark,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  items: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
