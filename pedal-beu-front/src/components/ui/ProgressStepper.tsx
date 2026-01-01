import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../../theme/colors";

interface Step {
  title: string;
  description?: string;
}

interface ProgressStepperProps {
  steps: Step[];
  currentStep: number;
  showLabels?: boolean;
}

const ProgressStepper: React.FC<ProgressStepperProps> = ({
  steps,
  currentStep,
  showLabels = true,
}) => {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withTiming(currentStep / (steps.length - 1), {
      duration: 500,
    });
  }, [currentStep]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={styles.container}>
      {/* Progress Line */}
      <View style={styles.progressBackground}>
        <Animated.View style={[styles.progressFill, progressStyle]} />
      </View>

      {/* Steps */}
      <View style={styles.stepsContainer}>
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          const isFuture = index > currentStep;

          return (
            <View key={index} style={styles.stepContainer}>
              {/* Step Circle */}
              <View
                style={[
                  styles.stepCircle,
                  isCompleted && styles.stepCircleCompleted,
                  isActive && styles.stepCircleActive,
                  isFuture && styles.stepCircleFuture,
                ]}
              >
                {isCompleted ? (
                  <Text style={styles.stepIcon}>✓</Text>
                ) : (
                  <Text
                    style={[
                      styles.stepNumber,
                      isActive && styles.stepNumberActive,
                      isFuture && styles.stepNumberFuture,
                    ]}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>

              {/* Step Labels */}
              {showLabels && (
                <View style={styles.labelContainer}>
                  <Text
                    style={[
                      styles.stepTitle,
                      isActive && styles.stepTitleActive,
                      isFuture && styles.stepTitleFuture,
                    ]}
                  >
                    {step.title}
                  </Text>
                  {step.description && (
                    <Text style={styles.stepDescription}>
                      {step.description}
                    </Text>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  progressBackground: {
    position: "absolute",
    top: 24,
    left: 40,
    right: 40,
    height: 4,
    backgroundColor: colors.gray200,
    borderRadius: 2,
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  stepsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stepContainer: {
    alignItems: "center",
    minWidth: 80,
  },
  stepCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.gray300,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  stepCircleCompleted: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepCircleActive: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  stepCircleFuture: {
    borderColor: colors.gray300,
    backgroundColor: colors.white,
  },
  stepIcon: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "bold",
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray400,
  },
  stepNumberActive: {
    color: colors.primary,
  },
  stepNumberFuture: {
    color: colors.gray400,
  },
  labelContainer: {
    alignItems: "center",
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray600,
    textAlign: "center",
  },
  stepTitleActive: {
    color: colors.primary,
  },
  stepTitleFuture: {
    color: colors.gray400,
  },
  stepDescription: {
    fontSize: 12,
    color: colors.gray500,
    textAlign: "center",
    marginTop: 2,
  },
});

export default ProgressStepper;
