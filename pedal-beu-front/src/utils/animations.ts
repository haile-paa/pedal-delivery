import {
  withSpring,
  withTiming,
  withSequence,
  withDelay,
} from "react-native-reanimated";

export const createEntranceAnimation = (index: number) => {
  return {
    opacity: withDelay(index * 100, withTiming(1, { duration: 500 })),
    transform: [
      { translateY: withDelay(index * 100, withSpring(0, { damping: 15 })) },
    ],
  };
};

export const pressAnimation = {
  transform: [{ scale: withSequence(withTiming(0.95), withSpring(1)) }],
};

export const shakeAnimation = {
  transform: [
    {
      translateX: withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 })
      ),
    },
  ],
};
