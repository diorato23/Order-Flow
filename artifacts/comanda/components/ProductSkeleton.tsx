import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withRepeat, 
  withSequence, 
  withTiming,
  interpolateColor
} from 'react-native-reanimated';
import Colors from '@/constants/colors';

const { width } = Dimensions.get('window');

export default function ProductSkeleton() {
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

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  return (
    <View style={styles.container}>
      {/* Imagem Placeholder */}
      <Animated.View style={[styles.image, animatedStyle]} />
      
      <View style={styles.content}>
        <View style={styles.row}>
          {/* Título */}
          <Animated.View style={[styles.title, animatedStyle]} />
          {/* Ícone Editar */}
          <Animated.View style={[styles.icon, animatedStyle]} />
        </View>
        
        {/* Descrição */}
        <Animated.View style={[styles.description, animatedStyle]} />
        <Animated.View style={[styles.descriptionShort, animatedStyle]} />
        
        <View style={styles.footer}>
          {/* Tag Categoria */}
          <Animated.View style={[styles.tag, animatedStyle]} />
          {/* Preço e Switch */}
          <View style={styles.right}>
            <Animated.View style={[styles.price, animatedStyle]} />
            <Animated.View style={[styles.switch, animatedStyle]} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.charcoal,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: Colors.warmDark,
  },
  content: {
    flex: 1,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    height: 16,
    width: '60%',
    borderRadius: 4,
    backgroundColor: Colors.warmDark,
  },
  icon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.warmDark,
  },
  description: {
    height: 10,
    width: '100%',
    borderRadius: 4,
    backgroundColor: Colors.warmDark,
  },
  descriptionShort: {
    height: 10,
    width: '40%',
    borderRadius: 4,
    backgroundColor: Colors.warmDark,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  tag: {
    height: 14,
    width: 50,
    borderRadius: 7,
    backgroundColor: Colors.warmDark,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  price: {
    height: 16,
    width: 60,
    borderRadius: 4,
    backgroundColor: Colors.warmDark,
  },
  switch: {
    height: 20,
    width: 36,
    borderRadius: 10,
    backgroundColor: Colors.warmDark,
  },
});
