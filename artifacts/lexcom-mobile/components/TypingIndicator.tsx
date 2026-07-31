import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';

function Dot({ delay }: { delay: number }) {
  const colors = useColors();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.3, { duration: 400 }),
        ),
        -1,
        false,
      ),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[styles.dot, { backgroundColor: colors.primary }, animStyle]}
    />
  );
}

export default function TypingIndicator() {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <View style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <DotRow />
      </View>
    </View>
  );
}

function DotRow() {
  return (
    <View style={styles.dots}>
      <Dot delay={0} />
      <Dot delay={180} />
      <Dot delay={360} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dots: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
